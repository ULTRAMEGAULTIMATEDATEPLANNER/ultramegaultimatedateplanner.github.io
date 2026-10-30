// Tests for the ticket alert: the page readers on trimmed copies of the real pages, then whole runs
// against a fake Telegram, fake ticket pages and a fake GitHub. Run: node .github/ticket-alert/watch.test.mjs
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readShop, readFestival } from "./watch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0, passes = 0;
const check = (label, ok, extra = "") => { ok ? passes++ : fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && extra !== "" ? "  → " + extra : ""}`); };

/* ---------- the page readers ---------- */

// Trimmed from tickets.lab111.nl (show 1312104, sold out) and an on-sale LAB111 show.
const SHOP_SOLDOUT = `<div style=""><span id='show-starts-at'>zo 01 november 2026, 16:20 - LAB 1</span></div><span class="sold-out-label"></br>SOLD OUT</br></br></span></div>
<script>let orderFormAttributes = {"not_available_label":"SOLD OUT","sold_out_label":"SOLD OUT"};</script>`;
const SHOP_ON_SALE = `<div style=""><span id='show-starts-at'>zo 01 november 2026, 16:20 - LAB 1</span></div><table id="order-form-table" class="table order-form-table"><thead><tr class="order-form-row order-form-row-header"><th>Kaartje</th><th>Prijs</th><th>Aantal</th></tr></thead><tr data-base-object-type="show" data-base-object-id="1312104" class="order-form-row order-form-row-qty"><td class="badge-type-label">Regulier</td><td>€ <span class='badge_type_price'> 13,00</span></td><td><select class="form-control select-quantity"><option value="">0</option><option value="1">1</option></select></td></tr></table>
<script>let orderFormAttributes = {"not_available_label":"SOLD OUT","sold_out_label":"SOLD OUT"};</script>`;
const SHOP_OTHER_SHOW = SHOP_ON_SALE.replace("zo 01 november 2026, 16:20 - LAB 1", "do 05 november 2026, 18:40 - LAB 4");
// Trimmed from imaginefilmfestival.nl/programma/nieuw-nederlands-peil-2/, plus another film's row on sale.
const FEST_SOLDOUT = `<table class="shows filterable" id="tickets"> <tr ; data-filter-date="1-nov"> <td class=" date"> <i class="fa fa-heart-o like" data-programid="31442" data-showid="647"></i> 1 nov </td> <td class="time">16:20</td> <td class="theatre">LAB111 1</td> <td class="ticket"> <a class="btn bg1 fg8" target="_blank">Sold Out</a> </td> </tr> <tr ; data-filter-date="4-Nov"> <td class=" date"> <i class="fa fa-heart-o like" data-programid="30940" data-showid="1345"></i> 4 Nov </td> <td class="time">16:30</td> <td class="theatre">FilmHallen 2</td> <td class="extra"> </td> <td class="ticket"> <a href="https://filmhallen.nl/tickets/202358" class="btn bg1 fg8" target="_blank">Tickets</a> </td> </tr> </table>`;
const FEST_ON_SALE = FEST_SOLDOUT.replace(`<a class="btn bg1 fg8" target="_blank">Sold Out</a>`, `<a href="https://tickets.lab111.nl/labcinema/nl/flow_configs/webshop/steps/start/show/1312104" class="btn bg1 fg8" target="_blank">Tickets</a>`);

check("Shop: sold out", readShop(SHOP_SOLDOUT).status === "soldout");
check("Shop: on sale", readShop(SHOP_ON_SALE).status === "available");
check("Shop: another show's page is not taken for ours", readShop(SHOP_OTHER_SHOW).status === "unknown");
check("Shop: a page without the show (error page, login wall) is unknown", readShop("<html><body>Er ging iets mis</body></html>").status === "unknown");
check("Shop: the words SOLD OUT in its scripts alone don't count", readShop(SHOP_ON_SALE).status === "available");
check("Shop: show present but neither label nor ticket table is unknown", readShop(`<span id='show-starts-at'>zo 01 november 2026, 16:20 - LAB 1</span><p>Even geduld</p>`).status === "unknown");
check("Festival: our row sold out (the 4 Nov row on sale doesn't count)", readFestival(FEST_SOLDOUT).status === "soldout");
const fo = readFestival(FEST_ON_SALE);
check("Festival: our row on sale, with its ticket link", fo.status === "available" && fo.link.endsWith("/show/1312104"));
check("Festival: screening missing is unknown", readFestival(FEST_SOLDOUT.replace(/data-showid="647"/, 'data-showid="7"')).status === "unknown");
check("Festival: a non-https link is ignored", readFestival(FEST_SOLDOUT.replace(`<a class="btn bg1 fg8" target="_blank">Sold Out</a>`, `<a href="javascript:alert(1)" class="btn">Tickets</a>`)).status === "unknown");

/* ---------- whole runs against fakes ---------- */

const OUR_CHAT = 4242, STRANGER = 999;
const fake = {
  shop: { code: 200, body: SHOP_SOLDOUT }, fest: { code: 200, body: FEST_SOLDOUT },
  sent: [], updates: [], nextUpdate: 1, failSend: false, gh: { files: {}, refs: { main: "abc123" }, disabled: false, puts: 0, dispatched: [], waitingStatus: null }
};
const userSays = (text, chat = OUR_CHAT) => fake.updates.push({ update_id: fake.nextUpdate++, message: { chat: { id: chat }, text } });

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const json = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (url.pathname === "/shop") {
      fake.shopHits = (fake.shopHits || 0) + 1;
      if (fake.shop.flaky && fake.shopHits % 2 === 1) { res.writeHead(502); return res.end("bad gateway"); }
      res.writeHead(fake.shop.code); return res.end(fake.shop.body);
    }
    if (url.pathname === "/fest") { res.writeHead(fake.fest.code); return res.end(fake.fest.body); }
    const tgm = /^\/tg\/bot(.+)\/(\w+)$/.exec(url.pathname);
    if (tgm) {
      if (tgm[1] !== "TEST:TOKEN") return json(401, { ok: false, description: "Unauthorized" });
      if (tgm[2] === "sendPhoto") {
        const caption = /name="caption"\r\n\r\n([\s\S]*?)\r\n--/.exec(body);
        fake.sent.push("[photo] " + (caption ? caption[1] : "")); return json(200, { ok: true, result: {} });
      }
      const b = JSON.parse(body || "{}");
      if (tgm[2] === "sendMessage") {
        if (fake.failSend) return json(500, { ok: false, description: "Internal Server Error" });
        if (String(b.chat_id) !== String(OUR_CHAT)) return json(400, { ok: false, description: "Bad Request: chat not found" });
        fake.sent.push(b.text); return json(200, { ok: true, result: { message_id: fake.sent.length } });
      }
      if (tgm[2] === "getUpdates") {
        fake.updates = fake.updates.filter(u => u.update_id >= (b.offset || 0));   // Telegram forgets acknowledged ones
        return json(200, { ok: true, result: fake.updates });
      }
      return json(404, { ok: false, description: "Not Found" });
    }
    // a tiny GitHub: contents API, refs and workflow disable for one repo
    const g = fake.gh;
    if (req.headers.authorization !== "Bearer GH-TEST") return json(401, { message: "Bad credentials" });
    let m;
    if ((m = /^\/gh\/repos\/me\/site\/contents\/state\.json$/.exec(url.pathname))) {
      const branch = req.method === "GET" ? url.searchParams.get("ref") : JSON.parse(body).branch;
      if (!(branch in g.refs)) return json(404, { message: "Branch not found" });
      const f = g.files[branch];
      if (req.method === "GET") return f ? json(200, { content: Buffer.from(f.text).toString("base64"), sha: f.sha }) : json(404, { message: "Not Found" });
      const b = JSON.parse(body);
      if (f && b.sha !== f.sha) return json(409, { message: "sha mismatch" });
      if (!f && b.sha) return json(422, { message: "sha given for a new file" });
      g.puts++;
      g.files[branch] = { text: Buffer.from(b.content, "base64").toString("utf8"), sha: "s" + g.puts };
      return json(f ? 200 : 201, { content: { sha: "s" + g.puts } });
    }
    if ((m = /^\/gh\/repos\/me\/site\/git\/ref\/heads\/(.+)$/.exec(url.pathname))) return m[1] in g.refs ? json(200, { object: { sha: g.refs[m[1]] } }) : json(404, { message: "Not Found" });
    if (url.pathname === "/gh/repos/me/site/git/refs" && req.method === "POST") { const b = JSON.parse(body); g.refs[b.ref.replace("refs/heads/", "")] = b.sha; return json(201, {}); }
    if (url.pathname === "/gh/repos/me/site/actions/workflows/ticket-alert.yml/disable" && req.method === "PUT") { g.disabled = true; res.writeHead(204); return res.end(); }
    if (url.pathname === "/gh/repos/me/site/actions/workflows/ticket-alert.yml/runs") return json(200, { total_count: url.searchParams.get("status") === g.waitingStatus ? 1 : 0, workflow_runs: [] });
    if (url.pathname === "/gh/repos/me/site/actions/workflows/ticket-alert.yml/dispatches" && req.method === "POST") { g.dispatched.push(JSON.parse(body).ref); res.writeHead(204); return res.end(); }
    json(404, { message: "Not Found" });
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const STATE = join(mkdtempSync(join(tmpdir(), "ticket-alert-")), "state.json");

const run = (extra = {}) => new Promise(resolve => {
  const env = {
    PATH: process.env.PATH, TZ: "UTC",
    TELEGRAM_BOT_TOKEN: "TEST:TOKEN", TELEGRAM_CHAT_ID: String(OUR_CHAT), TELEGRAM_API: `${BASE}/tg`,
    SHOP_URL: `${BASE}/shop`, FESTIVAL_URL: `${BASE}/fest`, STATE_FILE: STATE,
    CHECKS: "1", INTERVAL_SECONDS: "0.05", RETRY_SECONDS: "0", HEARTBEAT_HOUR: "99", STARTS_AT: "2099-01-01T00:00:00Z", ...extra
  };
  for (const k of Object.keys(env)) if (env[k] === null) delete env[k];
  execFile(process.execPath, [join(HERE, "watch.mjs")], { env, timeout: 30000 }, (err, stdout, stderr) => resolve({ err, out: stdout + stderr }));
});
const newSent = async (extra) => { const n = fake.sent.length; const r = await run(extra); return { msgs: fake.sent.slice(n), ...r }; };
const state = () => JSON.parse(readFileSync(STATE, "utf8"));

let r = await newSent({ TELEGRAM_BOT_TOKEN: null });
check("Without the secrets it waits quietly", r.msgs.length === 0 && /Waiting for the TELEGRAM_BOT_TOKEN/.test(r.out) && !r.err);

userSays("/start");                  // pressing Start in Telegram before the alert ran
userSays("/status", STRANGER);       // someone else who found the bot
r = await newSent();
check("First run: one welcome message (not also a reply to /start or to a stranger), with the status and commands", r.msgs.length === 1 && /Ticket alert is on/.test(r.msgs[0]) && /Right now: SOLD OUT/.test(r.msgs[0]) && /\/stop/.test(r.msgs[0]), r.msgs.join(" | "));
check("…and it remembers which messages it has read, and which screening it watches", state().offset === 3 && state().welcomed === true && state().last === "soldout" && state().show === "1312104");

r = await newSent();
check("Nothing new: no messages", r.msgs.length === 0, r.msgs.join(" | "));

userSays("/status");
r = await newSent();
check("/status answers with what the page says and when it was checked", r.msgs.length === 1 && /SOLD OUT/.test(r.msgs[0]) && /checked \d\d:\d\d/.test(r.msgs[0]) && /Alerts are on/.test(r.msgs[0]), r.msgs.join(" | "));
userSays("hello?");
r = await newSent();
check("Anything else gets the list of commands", r.msgs.length === 1 && /three commands/.test(r.msgs[0]));

fake.shop.body = SHOP_ON_SALE;
r = await newSent({ CHECKS: "3" });
check("Tickets appear: one alert with the shop link (not one per check)", r.msgs.length === 1 && /TICKETS AVAILABLE/.test(r.msgs[0]) && r.msgs[0].includes(`${BASE}/shop`), r.msgs.join(" | "));
r = await newSent();
check("Still on sale a moment later: no repeat yet", r.msgs.length === 0, r.msgs.join(" | "));
r = await newSent({ REALERT_MINUTES: "0" });
check("Still on sale after the reminder interval: “Still available”", r.msgs.length === 1 && /Still available/.test(r.msgs[0]), r.msgs.join(" | "));

userSays("/stop");
r = await newSent({ REALERT_MINUTES: "0" });
check("/stop pauses: confirmation, no alert", r.msgs.length === 1 && /^Paused/.test(r.msgs[0]) && state().paused === true, r.msgs.join(" | "));
userSays("/start");
r = await newSent({ REALERT_MINUTES: "0" });
check("/start turns alerts back on, with the status and a reminder", r.msgs.length === 2 && /TICKETS AVAILABLE – buy now/.test(r.msgs[0]) && /Still available/.test(r.msgs[1]) && state().paused === false, r.msgs.join(" | "));

fake.shop.body = SHOP_SOLDOUT;
r = await newSent();
check("Sold out again: says so once", r.msgs.length === 1 && /Sold out again/.test(r.msgs[0]), r.msgs.join(" | "));
r = await newSent();
check("…and not again", r.msgs.length === 0);

fake.shop = { code: 200, body: SHOP_SOLDOUT, flaky: true };
r = await newSent({ RETRY_SECONDS: "0.05" });
check("Shop fails once then answers: it tries again and uses the shop", r.msgs.length === 0 && /soldout \(LAB111\)/.test(r.out) && fake.shopHits >= 2, r.out);
fake.shop = { code: 503, body: "busy" };
r = await newSent();
check("Shop down, festival page says sold out: quiet, and the log says why the shop wasn't used", r.msgs.length === 0 && state().last === "soldout" && /soldout \(festival page\) – shop: LAB111's ticket page didn't load \(HTTP 503\)/.test(r.out), r.out);
fake.fest = { code: 200, body: FEST_ON_SALE };
r = await newSent();
check("Shop down, festival page on sale: alert with the festival's ticket link", r.msgs.length === 1 && /TICKETS AVAILABLE/.test(r.msgs[0]) && r.msgs[0].includes("/show/1312104"), r.msgs.join(" | "));
fake.shop = { code: 200, body: SHOP_SOLDOUT };
r = await newSent();
check("Shop back and sold out: it wins over the festival page", r.msgs.length === 1 && /Sold out again/.test(r.msgs[0]), r.msgs.join(" | "));

fake.shop = { code: 500, body: "" }; fake.fest = { code: 500, body: "" };
r = await newSent({ WARN_AFTER_MINUTES: "60" });
check("Both pages down briefly: no warning yet", r.msgs.length === 0 && state().unknownSince > 0);
r = await newSent({ WARN_AFTER_MINUTES: "0" });
check("Both down for a while: one warning with the link to check by hand", r.msgs.length === 1 && /can't read the ticket page/.test(r.msgs[0]) && r.msgs[0].includes(`${BASE}/shop`), r.msgs.join(" | "));
r = await newSent({ WARN_AFTER_MINUTES: "0" });
check("…not repeated", r.msgs.length === 0);
fake.shop = { code: 200, body: SHOP_SOLDOUT }; fake.fest = { code: 200, body: FEST_SOLDOUT };
r = await newSent();
check("Readable again: says so", r.msgs.length === 1 && /can read the ticket page again/.test(r.msgs[0]) && /SOLD OUT/.test(r.msgs[0]), r.msgs.join(" | "));

writeFileSync(STATE, JSON.stringify({ ...state(), heartbeatDay: "01/01/2020" }));
r = await newSent({ HEARTBEAT_HOUR: "0" });
check("Once a day: “Still watching”", r.msgs.length === 1 && /^Still watching/.test(r.msgs[0]), r.msgs.join(" | "));
r = await newSent({ HEARTBEAT_HOUR: "0" });
check("…only once that day", r.msgs.length === 0);

fake.shop.body = SHOP_ON_SALE; fake.failSend = true;
r = await newSent();
check("Telegram failing: no crash, nothing marked as sent", !r.err && state().alerted !== true && /sendMessage failed/.test(r.out), r.out);
fake.failSend = false;
r = await newSent();
check("…the alert goes out on the next run", r.msgs.length === 1 && /TICKETS AVAILABLE/.test(r.msgs[0]), r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
await newSent();

r = await newSent({ STARTS_AT: "2020-01-01T00:00:00Z" });
check("After the screening starts: goodbye, and no checking", r.msgs.length === 1 && /stopped watching/.test(r.msgs[0]) && state().done === true && !/soldout/.test(r.out), r.msgs.join(" | "));
r = await newSent({ STARTS_AT: "2020-01-01T00:00:00Z" });
check("…said only once", r.msgs.length === 0);

// It used to watch Pulse (memory without a screening number); now it watches another screening.
writeFileSync(STATE, JSON.stringify({ welcomed: true, heartbeatDay: state().heartbeatDay, offset: state().offset, last: "available", alerted: true, alertedAt: Date.now(), paused: true }));
r = await newSent();
check("Switched to another screening: says so once, with what it sees now", r.msgs.length === 1 && /^🔁 Switched: I'm now watching Nieuw Nederlands Peil 2/.test(r.msgs[0]) && /Right now: SOLD OUT/.test(r.msgs[0]), r.msgs.join(" | "));
check("…and starts afresh for it: alerts on, nothing carried over", state().show === "1312104" && state().paused === undefined && state().alerted === false && state().last === "soldout", JSON.stringify(state()));
r = await newSent();
check("…not repeated", r.msgs.length === 0, r.msgs.join(" | "));
fake.shop.body = SHOP_ON_SALE;
r = await newSent();
check("…and tickets for it give an alert straight away", r.msgs.length === 1 && /TICKETS AVAILABLE: Nieuw Nederlands Peil 2/.test(r.msgs[0]), r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
await newSent();
writeFileSync(STATE, JSON.stringify({ ...state(), show: "1312105" }));
fake.shop.body = SHOP_ON_SALE; fake.failSend = true;
r = await newSent();
check("Telegram failing during the switch: tried again next run", state().show === "1312105" && /sendMessage failed/.test(r.out), r.out);
fake.failSend = false;
r = await newSent();
check("…then the switch message and the alert", r.msgs.length === 2 && /Switched/.test(r.msgs[0]) && /TICKETS AVAILABLE/.test(r.msgs[1]) && state().show === "1312104", r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
await newSent();

const t0 = Date.now();
r = await newSent({ CHECKS: "50", INTERVAL_SECONDS: "0.3", RUN_SECONDS: "1" });
check("A run stops starting new checks when its time is up", Date.now() - t0 < 4000 && (r.out.match(/soldout \(LAB111\)/g) || []).length <= 4, `${Date.now() - t0} ms`);

/* ---------- booking the tickets itself (with a stand-in for buy.mjs) ---------- */

const DIR = mkdtempSync(join(tmpdir(), "ticket-buy-"));
const FAKE_BOOK = join(DIR, "fake-buy.mjs"), BOOK_FILE = join(DIR, "book.json");
writeFileSync(FAKE_BOOK, `import { readFileSync, writeFileSync } from "node:fs";
export async function book(o) {
  const d = JSON.parse(readFileSync(process.env.FAKE_BOOK_FILE, "utf8"));
  d.calls.push(o);
  const r = d.results.length > 1 ? d.results.shift() : d.results[0];
  writeFileSync(process.env.FAKE_BOOK_FILE, JSON.stringify(d));
  return { ...r, shot: r.shot ? Buffer.from(r.shot, "base64") : null };
}`);
const booking = results => writeFileSync(BOOK_FILE, JSON.stringify({ calls: [], results }));
const bookCalls = () => JSON.parse(readFileSync(BOOK_FILE, "utf8")).calls;
const PNG = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
const ME = { CINEVILLE_PASSES: "CP$111111111 , CP$222222222", TICKET_EMAIL: "us@example.org", TICKET_LAST_NAME: "Testerman", BOOK_MODULE: FAKE_BOOK, FAKE_BOOK_FILE: BOOK_FILE };
const secretsIn = out => ["111111111", "222222222", "us@example.org", "Testerman"].filter(x => out.includes(x));

writeFileSync(STATE, JSON.stringify({ welcomed: true, show: "1312104", heartbeatDay: "01/01/2020", offset: state().offset, last: "soldout" }));
fake.shop.body = SHOP_SOLDOUT;
booking([{ status: "booked", reason: "the shop confirmed the order", shot: PNG }]);
r = await newSent({ ...ME, HEARTBEAT_HOUR: "0" });
check("Auto-booking: says once that it's on, with the name, the email and how many tickets", r.msgs.length === 2 && /^🤖 Auto-booking is on/.test(r.msgs[0]) && /2 free Cineville tickets under the name Testerman, sent to us@example\.org/.test(r.msgs[0]) && /^Still watching/.test(r.msgs[1]), r.msgs.join(" | "));
check("…and the logs never show the passes, the email or the name", secretsIn(r.out).length === 0 && /Auto-booking: on/.test(r.out), secretsIn(r.out).join(", "));
r = await newSent(ME);
check("…not said again; nothing booked while sold out", r.msgs.length === 0 && bookCalls().length === 0, r.msgs.join(" | "));

fake.shop.body = SHOP_ON_SALE;
r = await newSent({ ...ME, STARTS_AT: "2099-11-01T16:20:00+01:00" });
const call = bookCalls()[0] || {};
check("Seats appear: says so, then books them (the shop page, our screening, both passes, email, name)", r.msgs.length === 2 && /^🎟 TICKETS AVAILABLE/.test(r.msgs[0]) && /Booking your 2 Cineville tickets right now/.test(r.msgs[0]) && call.url === `${BASE}/shop` && call.expect === "01 november 2026, 16:20" && call.passes.join() === "CP$111111111,CP$222222222" && call.email === "us@example.org" && call.lastName === "Testerman", r.msgs.join(" | ") + JSON.stringify(call));
check("…then a screenshot: booked, where the tickets go, and to be at the desk by 16:05", /^\[photo\] ✅ Booked: 2 Cineville tickets/.test(r.msgs[1]) && /us@example\.org/.test(r.msgs[1]) && /by 16:05/.test(r.msgs[1]) && state().booked === true, r.msgs.join(" | "));
check("…logs still clean", secretsIn(r.out).length === 0 && /Booking attempt 1: booked/.test(r.out), r.out);
r = await newSent({ ...ME, REALERT_MINUTES: "0" });
check("Booked: no reminders and no second booking while seats stay free", r.msgs.length === 0 && bookCalls().length === 1, r.msgs.join(" | "));
userSays("/status");
r = await newSent(ME);
check("…/status says it booked them", r.msgs.length === 1 && /✅ I booked your tickets/.test(r.msgs[0]), r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
writeFileSync(STATE, JSON.stringify({ ...state(), heartbeatDay: "01/01/2020" }));
r = await newSent({ ...ME, HEARTBEAT_HOUR: "0" });
check("…no “sold out again” and no daily message after booking", r.msgs.length === 0, r.msgs.join(" | "));

writeFileSync(STATE, JSON.stringify({ welcomed: true, show: "1312104", autoSaid: true, heartbeatDay: state().heartbeatDay, offset: state().offset, last: "soldout" }));
fake.shop.body = SHOP_ON_SALE;
booking([{ status: "failed", reason: "the shop didn't take the tickets", retry: true, shot: PNG }, { status: "failed", reason: "the shop didn't take the tickets", retry: true }, { status: "booked", reason: "ok", already: true }]);
r = await newSent(ME);
check("Booking fails: one ❌ with the reason and the link, and it keeps trying", r.msgs.length === 2 && /^\[photo\] ❌ I couldn't book: the shop didn't take the tickets/.test(r.msgs[1]) && /keep trying/.test(r.msgs[1]) && r.msgs[1].includes(`${BASE}/shop`), r.msgs.join(" | "));
r = await newSent(ME);
check("…fails again: tried, but no repeat message", r.msgs.length === 0 && bookCalls().length === 2, r.msgs.join(" | "));
r = await newSent(ME);
check("…then works (the shop says the passes already have them): ✅", r.msgs.length === 1 && /✅ Booked/.test(r.msgs[0]) && /already had them/.test(r.msgs[0]) && state().booked === true, r.msgs.join(" | "));

writeFileSync(STATE, JSON.stringify({ welcomed: true, show: "1312104", autoSaid: true, heartbeatDay: state().heartbeatDay, offset: state().offset, last: "soldout" }));
booking([{ status: "failed", reason: "one of the passes has reached Cineville's maximum number of bookings", final: true }]);
r = await newSent(ME);
check("A failure that retrying won't fix: says so and stops booking", r.msgs.length === 2 && /maximum number of bookings/.test(r.msgs[1]) && /I've stopped/.test(r.msgs[1]) && state().bookGaveUp === true, r.msgs.join(" | "));
r = await newSent({ ...ME, REALERT_MINUTES: "0" });
check("…then only the usual reminders with the link", r.msgs.length === 1 && /Still available/.test(r.msgs[0]) && bookCalls().length === 1, r.msgs.join(" | "));

writeFileSync(STATE, JSON.stringify({ welcomed: true, show: "1312104", autoSaid: true, heartbeatDay: state().heartbeatDay, offset: state().offset, last: "soldout" }));
booking([{ status: "soldout", reason: "sold out again" }, { status: "failed", reason: "the shop didn't take the tickets", retry: true }]);
r = await newSent(ME);
check("Gone again before it could book: only the “booking now” message…", r.msgs.length === 1 && /Booking your 2/.test(r.msgs[0]) && !state().booked && !state().bookGaveUp, r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
r = await newSent(ME);
check("…then one “sold out again before I could book”", r.msgs.length === 1 && /^Sold out again before I could book\. I'll keep watching and book the moment seats open up again\./.test(r.msgs[0]), r.msgs.join(" | "));
fake.shop.body = SHOP_ON_SALE;
r = await newSent(ME);
check("Seats again, booking fails: says so (even after an earlier failure)", r.msgs.length === 2 && /Booking your 2/.test(r.msgs[0]) && /❌ I couldn't book/.test(r.msgs[1]), r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
await newSent(ME);
fake.shop.body = SHOP_ON_SALE;
r = await newSent({ ...ME, BOOK_MODULE: join(DIR, "missing.mjs") });
check("The booking part itself breaking: a ❌ with the link, no crash, keeps trying", !r.err && r.msgs.length === 2 && /❌ I couldn't book: the booking part stopped/.test(r.msgs[1]) && !state().bookGaveUp, r.msgs.join(" | "));
fake.shop.body = SHOP_SOLDOUT;
await newSent(ME);
fake.shop.body = SHOP_ON_SALE;

writeFileSync(STATE, JSON.stringify({ welcomed: true, show: "1312104", autoSaid: true, heartbeatDay: state().heartbeatDay, offset: state().offset, last: "soldout", paused: true }));
booking([{ status: "booked", reason: "ok" }]);
r = await newSent(ME);
check("Paused with /stop: doesn't book", r.msgs.length === 0 && bookCalls().length === 0, r.msgs.join(" | "));

writeFileSync(STATE, JSON.stringify({ welcomed: true, show: "1312105", autoSaid: true, booked: true, heartbeatDay: state().heartbeatDay, offset: state().offset, last: "soldout" }));
r = await newSent(ME);
check("Tickets booked for the old screening don't count for the new one", r.msgs.length === 3 && /Switched/.test(r.msgs[0]) && /✅ Booked/.test(r.msgs[2]) && bookCalls().length === 1, r.msgs.join(" | "));

r = await newSent({ ...ME, GITHUB_ACTIONS: "true" });
check("On GitHub it asks for the passes, the email and the name to be hidden in the logs", ["CP$111111111", "111111111", "us@example.org", "Testerman"].every(v => r.out.includes(`::add-mask::${v}`)), r.out);
fake.shop.body = SHOP_SOLDOUT;
await newSent();

/* ---------- memory kept on GitHub, and switching itself off ---------- */

const ghEnv = { STATE_FILE: null, GITHUB_API: `${BASE}/gh`, GITHUB_TOKEN: "GH-TEST", GITHUB_REPOSITORY: "me/site", GITHUB_REF_NAME: "main" };
fake.updates = [];
r = await newSent({ ...ghEnv, CHECKS: "2" });
const g = fake.gh;
check("GitHub: first run creates the ticket-alert-state branch from main", g.refs["ticket-alert-state"] === "abc123", JSON.stringify(g.refs));
check("GitHub: …and saves state.json there (once, nothing changed on the second check)", g.puts === 1 && JSON.parse(g.files["ticket-alert-state"].text).welcomed === true, `${g.puts} saves`);
check("GitHub: welcome sent", r.msgs.length === 1 && /Ticket alert is on/.test(r.msgs[0]));
userSays("/stop");
r = await newSent({ ...ghEnv });
check("GitHub: the next run reads it back and updates it", g.puts === 2 && JSON.parse(g.files["ticket-alert-state"].text).paused === true && r.msgs.length === 1, `${g.puts} saves`);
check("GitHub: each run starts the next one", g.dispatched.length === 2 && g.dispatched.every(x => x === "main") && /Started the next run/.test(r.out), JSON.stringify(g.dispatched));
g.waitingStatus = "pending";
r = await newSent({ ...ghEnv });
check("GitHub: …but not when one is already waiting", g.dispatched.length === 2 && /already pending/.test(r.out), r.out);
g.waitingStatus = null;
r = await newSent({ ...ghEnv, TELEGRAM_API: "http://127.0.0.1:9/tg" });
check("GitHub: …even when a run goes wrong (Telegram unreachable)", g.dispatched.length === 3, r.out);
r = await newSent({ ...ghEnv, STARTS_AT: "2020-01-01T00:00:00Z" });
check("GitHub: after the screening it switches its own workflow off", g.disabled === true && /switched off/.test(r.out), r.out);
check("GitHub: …and starts no further run", g.dispatched.length === 3, JSON.stringify(g.dispatched));

server.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
