// Books our free Cineville tickets in LAB111's ticket shop with a real browser, the way a person
// would: Cineville × the number of passes, one pass number per ticket, last name, email, the terms
// box, then "Bestelling plaatsen". It never pays: if the shop sends it anywhere else (a payment
// page), it stops there. Needs playwright-core (the workflow installs it) and Chrome (GitHub's
// runners have it).
import { createRequire } from "node:module";

const env = process.env;

// The shop's Cineville errors (its own words, see cinevilleErrors on the shop page). The first means
// we already have these tickets; the rest won't be fixed by trying again.
const ALREADY = /bestaat al een reservering voor deze voorstelling/i;
const FINAL = [
  [/overlapt/i, "one of the passes already has a Cineville booking that overlaps this screening"],
  [/maximum aantal reserveringen/i, "one of the passes has reached Cineville's maximum number of bookings"],
  [/Cineville Klantenservice/i, "Cineville won't take one of the passes right now (Cineville's customer service can say why)"],
  [/niet (?:\(meer\) |meer )?mogelijk|al begonnen/i, "the shop no longer takes Cineville bookings for this screening"]
];
const PASS_REJECTED = /not valid|not found|ongeldig|niet geldig|niet gevonden|onbekend|invalid/i;
const HELP_TEXT = /^Naar dit adres sturen we de kaartjes\.?$/;

export const passList = text => String(text || "").split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
const otherFormat = p => (p.startsWith("CP$") ? p.slice(3) : "CP$" + p);

// What the shop says on the page: its "Oeps..." pop-up (SweetAlert) and error texts. Browser pop-ups
// (alert) are caught separately.
const POPUP = ".sweet-alert p, .swal2-html-container";
const visibleErrors = page => page.evaluate(help => [...document.querySelectorAll(".sweet-alert p, .swal2-html-container, .help-block, .alert, .error, .flash")]
  .filter(e => e.offsetWidth || e.offsetHeight)
  .map(e => (e.innerText || "").replace(/\s+/g, " ").trim())
  .filter(t => t && !new RegExp(help).test(t)), HELP_TEXT.source).catch(() => []);

async function attempt(browser, o) {
  const ctx = await browser.newContext({ locale: "nl-NL", viewport: { width: 900, height: 1300 } });
  const page = await ctx.newPage();
  const said = [];   // the shop's pop-up messages
  page.on("dialog", d => { said.push(d.message()); d.accept().catch(() => {}); });
  const done = async (status, reason, extra = {}) =>
    ({ status, reason, shot: await page.screenshot().catch(() => null), ...extra });
  try {
    await page.goto(o.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const when = await page.locator("#show-starts-at").textContent({ timeout: 20000 }).catch(() => "");
    if (!when.includes(o.expect)) return await done("failed", "the shop didn't show our screening", { retry: true });
    if (await page.locator(".sold-out-label").count()) return await done("soldout", "sold out again");

    const n = o.count || o.passes.length;
    const qty = page.locator("tr", { hasText: o.ticket }).locator("select.select-quantity").first();
    if (!(await qty.count())) return await done("failed", `the shop doesn't offer ${o.ticket} tickets for this screening right now`, { retry: true });
    const options = await qty.locator("option").evaluateAll(os => os.map(x => x.value));
    if (!options.includes(String(n))) return await done("failed", `the shop won't sell ${n} ${o.ticket} tickets right now`, { retry: true });

    const answered = page.waitForResponse(r => /gateway\/add_to_basket/.test(r.url()), { timeout: 25000 }).catch(() => null);
    await qty.selectOption(String(n));
    if (o.passes.length) {
      const boxes = page.locator("#modal input[name='badge_codes[]']");
      await boxes.nth(n - 1).waitFor({ timeout: 15000 });
      for (let i = 0; i < n; i++) await boxes.nth(i).fill(o.passes[i]);
      await page.locator("#send-badge-codes").click();
    }
    await answered;
    await page.waitForTimeout(1500);   // the shop's script updates the page after answering
    const msgs = [...said, ...(await visibleErrors(page))];
    const text = msgs.join(" ");
    if (ALREADY.test(text)) return await done("booked", "these passes already have tickets for this screening", { already: true });
    for (const [re, why] of FINAL) if (re.test(text)) return await done("failed", why, { final: true });
    if ((await qty.inputValue().catch(() => "")) !== String(n))
      return await done("failed", text ? `the shop didn't take the tickets (“${text}”)` : "the shop didn't take the tickets", { retry: true, passRejected: !!o.passes.length && (!text || PASS_REJECTED.test(text)) });
    // The tickets are in the basket; close any pop-up that would sit in front of the form.
    if (await page.locator(POPUP).filter({ visible: true }).count())
      await page.locator(".sweet-alert button.confirm, .swal2-confirm").filter({ visible: true }).first().click({ timeout: 3000 }).catch(() => {});

    await page.fill("#single_page_checkout_component_last_name", o.lastName);
    await page.fill("#single_page_checkout_component_email", o.email);
    await page.press("#single_page_checkout_component_email", "Tab");
    const terms = page.locator("input[name='single_page_checkout_component[terms]']");
    if (!(await terms.isChecked())) await terms.check();
    const submit = page.locator("#single_page_checkout_component_submit");
    await page.waitForFunction(() => { const b = document.querySelector("#single_page_checkout_component_submit"); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
    if (await submit.isDisabled()) return await done("failed", "the order button stayed grey after filling everything in", { retry: true });
    if (o.dryRun) {
      const r = await done("ready", "everything filled in; stopped before placing the order (test)");
      await qty.selectOption("0").catch(() => {});   // give the seats back
      await page.waitForTimeout(1500);
      return r;
    }

    const before = page.url(), shopHost = new URL(o.url).hostname;
    said.length = 0;
    await submit.click();
    await page.waitForURL(u => u.href !== before, { timeout: 45000 }).catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(2000);
    const host = new URL(page.url()).hostname;
    if (host !== shopHost) return await done("failed", `after “Bestelling plaatsen” the shop sent me to ${host} (a payment page?), so I stopped there`, { final: true });
    const after = [...said, ...(await visibleErrors(page))].join(" ");
    if (ALREADY.test(after)) return await done("booked", "these passes already have tickets for this screening", { already: true });
    for (const [re, why] of FINAL) if (re.test(after)) return await done("failed", why, { final: true });
    const body = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    if (/bedankt|bevestig|gelukt|geslaagd|thank you|bestelnummer|ordernummer/i.test(body)) return await done("booked", "the shop confirmed the order");
    if (page.url() === before && after) return await done("failed", `the shop said: “${after}”`, { retry: true });
    return await done("unclear", "I pressed “Bestelling plaatsen” but couldn't see a confirmation", { retry: true });
  } catch (e) {
    return await done("failed", `something went wrong in the shop (${String(e.message).split("\n")[0]})`, { retry: true });
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Returns { status: booked | soldout | failed | unclear | ready, reason, shot (PNG), already, final, retry }.
// If the passes aren't accepted as typed, it tries them once more with or without the CP$ in front.
export async function book({ url, expect, passes = [], email = "", lastName = "", ticket = "Cineville", count, dryRun = false }) {
  let browser;
  try {
    const { chromium } = createRequire(import.meta.url)(env.PLAYWRIGHT || "playwright-core");
    const args = (env.CHROME_ARGS || "").split(" ").filter(Boolean);   // only for trying it out locally
    browser = await chromium.launch(env.CHROME_PATH ? { executablePath: env.CHROME_PATH, args } : { channel: "chrome", args });
  } catch (e) {
    return { status: "failed", reason: `I couldn't start the browser (${String(e.message).split("\n")[0]})`, retry: true };
  }
  try {
    const o = { url, expect, passes, email, lastName, ticket, count, dryRun };
    let r = await attempt(browser, o);
    if (r.status === "failed" && r.passRejected) {
      const r2 = await attempt(browser, { ...o, passes: passes.map(otherFormat) });
      if (!(r2.status === "failed" && r2.passRejected)) r = r2;
    }
    return r;
  } finally {
    await browser.close().catch(() => {});
  }
}
