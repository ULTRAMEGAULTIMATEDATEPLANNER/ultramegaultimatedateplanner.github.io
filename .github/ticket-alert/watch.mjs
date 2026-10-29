// Ticket alert: messages us on Telegram the moment tickets open up for the sold-out screening of
// Pulse at the Imagine Film Festival (Sun 1 Nov 2026, 18:35, LAB111, with the director's Q&A).
//
// GitHub Actions runs it back to back (each run starts the next; a 5-minute schedule restarts the
// chain if it ever breaks), checking about once a minute. The source of truth is LAB111's own ticket shop; the festival
// page is only used when the shop can't be read. Telegram commands: /status, /stop, /start.
// Its memory (what was last seen, what was already sent) is state.json on the ticket-alert-state
// branch. After the screening starts it says goodbye and switches its own workflow off.

const env = process.env;
const num = (v, d) => (v !== undefined && v !== "" && isFinite(+v) ? +v : d);

export const SHOW = {
  label: "Pulse, Sun 1 Nov 18:35 at LAB111 (with the director's Q&A)",
  startsAt: Date.parse(env.STARTS_AT || "2026-11-01T18:35:00+01:00"),
  shopUrl: env.SHOP_URL || "https://tickets.lab111.nl/labcinema/nl/flow_configs/webshop/steps/start/show/1312105",
  shopExpect: "01 november 2026, 18:35",
  festivalUrl: env.FESTIVAL_URL || "https://www.imaginefilmfestival.nl/en/film/pulse-2/",
  festivalShowId: "711"
};

const CHECKS = num(env.CHECKS, 5);
const INTERVAL_MS = num(env.INTERVAL_SECONDS, 55) * 1000;
const RUN_MS = num(env.RUN_SECONDS, 270) * 1000;            // no new check after this, so runs don't pile up
const RETRY_MS = num(env.RETRY_SECONDS, 4) * 1000;          // LAB111's shop is sometimes slow: one more try
const REALERT_MS = num(env.REALERT_MINUTES, 10) * 60000;    // reminders while tickets stay on sale
const WARN_AFTER_MS = num(env.WARN_AFTER_MINUTES, 15) * 60000; // pages unreadable this long: say so once
const HEARTBEAT_HOUR = num(env.HEARTBEAT_HOUR, 10);          // daily "still watching", Amsterdam time
const TG_API = env.TELEGRAM_API || "https://api.telegram.org";
const GH_API = env.GITHUB_API || "https://api.github.com";
const TOKEN = env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = String(env.TELEGRAM_CHAT_ID || "").trim();
const STATE_BRANCH = "ticket-alert-state";
const UA = "Mozilla/5.0 (compatible; personal ticket alert; one check a minute)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- reading the pages ---------- */

// LAB111's shop: a sold-out show has a SOLD OUT label; a show on sale has the ticket table with a
// "how many" dropdown. Anything else (or another show) is "unknown".
export function readShop(html, expect = SHOW.shopExpect) {
  const when = /id=['"]show-starts-at['"]>([^<]*)</.exec(html);
  if (!when || !when[1].includes(expect)) return { status: "unknown", why: "the screening isn't on LAB111's ticket page" };
  if (/class=['"]sold-out-label['"]/.test(html)) return { status: "soldout" };
  if (/id=['"]order-form-table['"]/.test(html) && /select-quantity/.test(html)) return { status: "available" };
  return { status: "unknown", why: "LAB111's ticket page looks different than expected" };
}

// The festival page: the screening's row has a "Sold Out" button without a link, or a "Tickets" link.
export function readFestival(html, showId = SHOW.festivalShowId) {
  const i = html.indexOf(`data-showid="${showId}"`);
  if (i < 0) return { status: "unknown", why: "the screening isn't on the festival page" };
  const end = html.indexOf("</tr>", i);
  const row = html.slice(i, end < 0 ? i + 3000 : end);
  const a = /<td class="ticket">\s*<a([^>]*)>([^<]*)<\/a>/.exec(row);
  if (!a) return { status: "unknown", why: "the festival page looks different than expected" };
  const href = /href="(https:[^"]+)"/.exec(a[1]);
  if (/sold\s*out|uitverkocht/i.test(a[2])) return { status: "soldout" };
  if (href) return { status: "available", link: href[1] };
  return { status: "unknown", why: "the festival page looks different than expected" };
}

async function getPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "nl,en;q=0.8" }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    throw ctrl.signal.aborted ? new Error("no answer within 20 seconds") : e;
  } finally { clearTimeout(t); }
}

async function readShopNow() {
  try { return readShop(await getPage(SHOW.shopUrl)); }
  catch (e) { return { status: "unknown", why: `LAB111's ticket page didn't load (${e.message})` }; }
}

// The shop decides whenever it gives a clear answer (after a second try); the festival page only
// fills in when it can't.
export async function check() {
  let shop = await readShopNow();
  if (shop.status === "unknown") { await sleep(RETRY_MS); shop = await readShopNow(); }
  if (shop.status !== "unknown") return { ...shop, link: SHOW.shopUrl, source: "LAB111" };
  let fest;
  try { fest = readFestival(await getPage(SHOW.festivalUrl)); }
  catch (e) { fest = { status: "unknown", why: `the festival page didn't load (${e.message})` }; }
  if (fest.status !== "unknown") return { link: SHOW.shopUrl, ...fest, source: "festival page", note: shop.why };
  return { status: "unknown", why: `${shop.why}; ${fest.why}` };
}

/* ---------- Telegram ---------- */

async function tg(method, body) {
  const res = await fetch(`${TG_API}/bot${TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${method} failed: ${j.description || "HTTP " + res.status}`);
  return j.result;
}
const say = text => tg("sendMessage", { chat_id: CHAT_ID, text, disable_web_page_preview: true });

/* ---------- memory (state.json on its own branch) ---------- */

const REPO = env.GITHUB_REPOSITORY || "";
const ghFetch = (path, init = {}) => fetch(`${GH_API}${path}`, {
  ...init,
  headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", ...(init.headers || {}) }
});

async function loadState() {
  if (env.STATE_FILE) {
    const fs = await import("node:fs");
    try { return { state: JSON.parse(fs.readFileSync(env.STATE_FILE, "utf8")), sha: null }; } catch { return { state: {}, sha: null }; }
  }
  const res = await ghFetch(`/repos/${REPO}/contents/state.json?ref=${STATE_BRANCH}`);
  if (res.status === 404) return { state: {}, sha: null };
  if (!res.ok) throw new Error(`reading state.json: HTTP ${res.status}`);
  const j = await res.json();
  return { state: JSON.parse(Buffer.from(j.content, "base64").toString("utf8")), sha: j.sha };
}

async function ensureStateBranch() {
  const has = await ghFetch(`/repos/${REPO}/git/ref/heads/${STATE_BRANCH}`);
  if (has.ok) return;
  const main = await (await ghFetch(`/repos/${REPO}/git/ref/heads/${env.GITHUB_REF_NAME || "main"}`)).json();
  const made = await ghFetch(`/repos/${REPO}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${STATE_BRANCH}`, sha: main.object.sha }) });
  if (!made.ok && made.status !== 422) throw new Error(`creating ${STATE_BRANCH}: HTTP ${made.status}`);
}

async function saveState(state, sha) {
  const text = JSON.stringify(state, null, 2) + "\n";
  if (env.STATE_FILE) { (await import("node:fs")).writeFileSync(env.STATE_FILE, text); return null; }
  if (!sha) await ensureStateBranch();
  const res = await ghFetch(`/repos/${REPO}/contents/state.json`, {
    method: "PUT",
    body: JSON.stringify({ message: "Ticket alert: update state", content: Buffer.from(text).toString("base64"), branch: STATE_BRANCH, ...(sha ? { sha } : {}) })
  });
  if (!res.ok) throw new Error(`saving state.json: HTTP ${res.status}`);
  return (await res.json()).content.sha;
}

// GitHub's 5-minute schedule can start late or skip runs, so each run starts the next one itself
// (unless one is already waiting); the schedule stays as a backup that restarts a broken chain.
async function startNextRun() {
  if (env.STATE_FILE || !REPO) return;
  for (const status of ["queued", "pending", "waiting", "requested"]) {
    const res = await ghFetch(`/repos/${REPO}/actions/workflows/ticket-alert.yml/runs?status=${status}&per_page=1`);
    if (res.ok && (await res.json()).total_count > 0) { console.log(`The next run is already ${status}.`); return; }
  }
  const res = await ghFetch(`/repos/${REPO}/actions/workflows/ticket-alert.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: env.GITHUB_REF_NAME || "main" }) });
  console.log(res.ok ? "Started the next run." : `Couldn't start the next run: HTTP ${res.status}`);
}

async function switchOff() {
  if (env.STATE_FILE || !REPO) return;
  const res = await ghFetch(`/repos/${REPO}/actions/workflows/ticket-alert.yml/disable`, { method: "PUT" });
  console.log(res.ok ? "Workflow switched off." : `Couldn't switch the workflow off: HTTP ${res.status}`);
}

/* ---------- the watch ---------- */

const ams = (ms, opts) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", ...opts }).format(new Date(ms));
const clock = ms => ams(ms, { hour: "2-digit", minute: "2-digit" });
const dayKey = ms => ams(ms, { year: "numeric", month: "2-digit", day: "2-digit" });
const hourOf = ms => +ams(ms, { hour: "2-digit", hourCycle: "h23" });
const WORD = { soldout: "SOLD OUT", available: "TICKETS AVAILABLE", unknown: "can't tell right now" };
const HELP = "/status – what the ticket page says right now\n/stop – pause the alerts (e.g. once you have tickets)\n/start – turn them back on";

function statusText(st, r, at) {
  const line = r.status === "available" ? `TICKETS AVAILABLE – buy now: ${r.link}` : WORD[r.status] + (r.status === "unknown" ? ` (${r.why})` : "");
  return `${SHOW.label}:\n${line}\n(checked ${clock(at)})\n\nAlerts are ${st.paused ? "paused – send /start to turn them back on" : "on"}.`;
}

async function handleCommands(st, r, at, justWelcomed) {
  const updates = await tg("getUpdates", { offset: st.offset || 0, timeout: 0, allowed_updates: ["message"] });
  for (const u of updates) {
    st.offset = u.update_id + 1;
    const m = u.message;
    if (!m || String(m.chat && m.chat.id) !== CHAT_ID || typeof m.text !== "string") continue;   // only our own chat
    const cmd = m.text.trim().split(/[\s@]/)[0].toLowerCase();
    if (cmd === "/stop") { st.paused = true; await say("Paused. I'll keep checking, but won't send alerts until you send /start."); }
    else if (cmd === "/start") {
      if (justWelcomed) continue;   // the welcome message answers the first /start
      st.paused = false;
      await say(statusText(st, r, at));
    }
    else if (cmd === "/status") await say(statusText(st, r, at));
    else await say(`I only know three commands:\n${HELP}`);
  }
}

async function step(st, now) {
  if (now >= SHOW.startsAt) {
    if (!st.done) {
      st.done = true;   // switch off even if the goodbye can't be sent
      await say("The screening has started, so I've stopped watching. Enjoy the film! 🎬").catch(e => console.log(e.message));
    }
    return "done";
  }
  const r = await check();
  console.log(`${clock(now)} ${r.status}${r.source ? " (" + r.source + ")" : ""}${r.why ? ": " + r.why : ""}${r.note ? " – shop: " + r.note : ""}`);

  const welcome = !st.welcomed;
  if (welcome) {
    await say(`👋 Ticket alert is on.\nI'm watching ${SHOW.label}. Right now: ${WORD[r.status]}.\nI check about once a minute and will message you here the moment tickets appear.\n\n${HELP}`);
    st.welcomed = true;
    st.heartbeatDay = dayKey(now);
  }
  await handleCommands(st, r, now, welcome);

  if (r.status === "available") {
    const first = st.last !== "available";
    if (!st.paused && (first || now - (st.alertedAt || 0) >= REALERT_MS)) {
      await say(`🎟 ${first ? "TICKETS AVAILABLE" : "Still available"}: ${SHOW.label}.\nBuy now: ${r.link}\n\n(Seen at ${clock(now)}. I'll remind you every ${Math.round(REALERT_MS / 60000)} minutes while they're on sale; send /stop once you have them.)`);
      st.alertedAt = now;
      st.alerted = true;
    }
  } else if (r.status === "soldout" && st.last === "available" && st.alerted && !st.paused) {
    await say("Sold out again. I'll keep watching and message you if seats open up again.");
  }

  if (r.status === "unknown") {
    st.unknownSince = st.unknownSince || now;
    if (!st.warned && now - st.unknownSince >= WARN_AFTER_MS) {
      await say(`⚠️ I can't read the ticket page right now (${r.why}). I'll keep trying; to be safe, check it yourself now and then:\n${SHOW.shopUrl}`);
      st.warned = true;
    }
  } else {
    if (st.warned) await say(`✅ I can read the ticket page again. Right now: ${WORD[r.status]}.`);
    st.unknownSince = 0;
    st.warned = false;
    if (r.status === "soldout") st.alerted = false;
    st.last = r.status;
  }

  if (!st.paused && r.status !== "available" && st.heartbeatDay !== dayKey(now) && hourOf(now) >= HEARTBEAT_HOUR) {
    await say(`Still watching ${SHOW.label}. Right now: ${WORD[r.status]} (checked ${clock(now)}).`);
    st.heartbeatDay = dayKey(now);
  }
  return "ok";
}

async function main() {
  if (!TOKEN || !CHAT_ID) { console.log("Waiting for the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets."); return; }
  const startedAt = Date.now();
  try {
    let { state: st, sha } = await loadState();
    for (let i = 0; i < CHECKS; i++) {
      if (i && Date.now() - startedAt + INTERVAL_MS > RUN_MS) break;
      if (i) await sleep(INTERVAL_MS);
      const before = JSON.stringify(st);
      let res;
      try { res = await step(st, Date.now()); }
      catch (e) { console.log(`Check failed: ${e.message}`); }
      if (JSON.stringify(st) !== before) sha = await saveState(st, sha);
      if (res === "done") { await switchOff(); return; }
    }
  } finally {
    if (Date.now() < SHOW.startsAt) await startNextRun().catch(e => console.log(`Couldn't start the next run: ${e.message}`));
  }
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.log(`Ticket alert stopped: ${e.message}`); });
}
