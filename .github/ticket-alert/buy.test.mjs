// Tests for buy.mjs: it books against a pretend LAB111 shop (same markup and steps as the real one:
// a Cineville row whose passes go in a pop-up, then name, email, terms and "Bestelling plaatsen").
// Needs playwright-core and a Chrome/Chromium:
//   PLAYWRIGHT=/path/to/playwright-core CHROME_PATH=/path/to/chrome node .github/ticket-alert/buy.test.mjs
import http from "node:http";
import { book } from "./buy.mjs";

let fails = 0, passes = 0;
const check = (label, ok, extra = "") => { ok ? passes++ : fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && extra !== "" ? "  → " + extra : ""}`); };

const shop = {};
const reset = over => Object.assign(shop, {
  when: "zo 01 november 2026, 16:20 - LAB 1", soldout: false, max: 10, cineville: true,
  valid: ["CP$111111111", "CP$222222222"], error: null, after: "confirm", baskets: [], orders: []
}, over);

const page = () => `<!doctype html><html><body>
<div id="modal" style="display:none"><h4>Vul je pasnummer(s) in:</h4><div id="badge_codes"></div><div class="btn" id="send-badge-codes">OK</div></div>
<span id='show-starts-at'>${shop.when}</span>
${shop.soldout ? `<span class="sold-out-label">SOLD OUT</span>` : `<table id="order-form-table">
<tr><td>Regulier</td><td><select class="form-control select-quantity" data-must-be-identified="false">${[...Array(11).keys()].map(i => `<option value="${i}">${i}</option>`).join("")}</select></td></tr>
${shop.cineville ? `<tr><td>Cineville</td><td><select class="form-control select-quantity" data-must-be-identified="true">${[...Array(shop.max + 1).keys()].map(i => `<option value="${i}">${i}</option>`).join("")}</select></td></tr>` : ""}
</table>`}
<form method="post" action="/order">
<input id="single_page_checkout_component_last_name" name="single_page_checkout_component[last_name]">
<input id="single_page_checkout_component_email" name="single_page_checkout_component[email]" type="email"><small class="help-block">Naar dit adres sturen we de kaartjes.</small>
<span class="pass-error help-block" style="display:none">! Not valid!</span>
<label><input type="checkbox" name="single_page_checkout_component[terms]"> algemene voorwaarden</label>
<button type="submit" id="single_page_checkout_component_submit" disabled>Bestelling plaatsen</button>
</form>
<script>
let basket = 0, pending = null;
const $ = s => document.querySelector(s);
// like LAB111's SweetAlert "Oeps..." pop-up: an overlay in front of the whole page until OK is pressed
function popup(text) {
  const d = document.createElement("div");
  d.innerHTML = '<div class="sweet-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.4)"></div><div class="sweet-alert showSweetAlert visible" style="position:fixed;top:30%;left:20%;width:60%;background:#fff;z-index:9"><h2>Oeps...</h2><p></p><button class="confirm">OK</button></div>';
  d.querySelector("p").textContent = text;
  d.querySelector("button").onclick = () => d.remove();
  document.body.append(d);
}
function ready() { $("#single_page_checkout_component_submit").disabled = !(basket && $("#single_page_checkout_component_last_name").value && $("#single_page_checkout_component_email").value && document.querySelector("[name='single_page_checkout_component[terms]']").checked); }
function add(sel, codes) {
  const q = new URLSearchParams(); codes.forEach(c => q.append("badge_codes[]", c)); q.set("quantity", sel.value);
  fetch("/gateway/add_to_basket?" + q).then(r => r.json()).then(j => {
    if (j.error) { popup(j.error); sel.value = ""; $(".pass-error").style.display = "inline"; }
    else if (j.note) { popup(j.note); basket = +sel.value; }
    else { basket = +sel.value; $(".pass-error").style.display = "none"; }
    ready();
  });
}
document.querySelectorAll("select.select-quantity").forEach(sel => sel.addEventListener("change", () => {
  if (sel.dataset.mustBeIdentified === "true" && +sel.value > 0) {
    $("#badge_codes").innerHTML = Array.from({ length: +sel.value }, () => '<div class="barcode-container"><input name="badge_codes[]" type="text"></div>').join("");
    $("#modal").style.display = "block"; pending = sel;
  } else add(sel, []);
}));
$("#send-badge-codes").addEventListener("click", () => { $("#modal").style.display = "none"; add(pending, [...document.querySelectorAll("#badge_codes input")].map(i => i.value)); });
document.querySelectorAll("input").forEach(i => i.addEventListener("input", ready));
document.querySelector("[name='single_page_checkout_component[terms]']").addEventListener("change", ready);
</script></body></html>`;

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/show") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(page()); }
    if (url.pathname === "/gateway/add_to_basket") {
      const codes = url.searchParams.getAll("badge_codes[]"), quantity = +url.searchParams.get("quantity");
      shop.baskets.push({ codes, quantity });
      const error = codes.length && (shop.error || (codes.every(c => shop.valid.includes(c)) ? null : `Card not found - Card with barcode ${codes[0]} not found`));
      res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(error ? { error } : shop.note ? { ok: true, note: shop.note } : { ok: true }));
    }
    if (url.pathname === "/order" && req.method === "POST") {
      shop.orders.push(Object.fromEntries(new URLSearchParams(body)));
      if (shop.after === "pay") { res.writeHead(302, { location: `http://localhost:${server.address().port}/pay` }); return res.end(); }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(shop.after === "confirm" ? "<h1>Bedankt voor je bestelling!</h1><p>De kaartjes komen per e-mail.</p>" : "<h1>Even geduld</h1>");
    }
    if (url.pathname === "/pay") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<h1>Kies je bank</h1>"); }
    res.writeHead(404); res.end();
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${server.address().port}/show`;
const US = { url: URL_, expect: "01 november 2026, 16:20", passes: ["CP$111111111", "CP$222222222"], email: "us@example.org", lastName: "Testerman" };
const isPng = b => Buffer.isBuffer(b) && b.subarray(1, 4).toString() === "PNG";

reset();
let r = await book(US);
const o = shop.orders[0] || {};
check("Books: Cineville × 2 with both passes, then name, email and terms, and sees the confirmation", r.status === "booked" && shop.baskets.length === 1 && shop.baskets[0].quantity === 2 && shop.baskets[0].codes.join() === US.passes.join() && shop.orders.length === 1, JSON.stringify({ r: { ...r, shot: !!r.shot }, shop }));
check("…the order carries our last name, email and the ticked terms", o["single_page_checkout_component[last_name]"] === "Testerman" && o["single_page_checkout_component[email]"] === "us@example.org" && o["single_page_checkout_component[terms]"] === "on", JSON.stringify(o));
check("…with a screenshot of the shop's answer", isPng(r.shot));

reset({ valid: ["111111111", "222222222"] });
r = await book(US);
check("Passes only taken without CP$: tries again that way and books once", r.status === "booked" && shop.baskets.length === 2 && shop.baskets[1].codes.join() === "111111111,222222222" && shop.orders.length === 1, JSON.stringify(shop.baskets));
reset({ valid: ["CP$111111111", "CP$222222222"] });
r = await book({ ...US, passes: ["111111111", "222222222"] });
check("…and the other way round (typed without CP$, taken with it)", r.status === "booked" && shop.orders.length === 1);
reset({ valid: [] });
r = await book(US);
check("Passes not taken either way: failed with the shop's words, will retry, no order", r.status === "failed" && r.retry && /didn't take the tickets \(“.*Card not found/.test(r.reason) && shop.orders.length === 0 && shop.baskets.length === 2, r.reason);
reset({ note: "Let op: deze voorstelling is in het Nederlands." });
r = await book(US);
check("A harmless pop-up after the tickets go in: closes it and still books", r.status === "booked" && shop.orders.length === 1, r.reason);

reset({ error: "Voor pasnummer CP$111111111 bestaat al een reservering voor deze voorstelling." });
r = await book(US);
check("Shop says the passes already have tickets: counts as booked, no new order", r.status === "booked" && r.already && shop.orders.length === 0, r.reason);
reset({ error: "Voor pasnummer CP$111111111 is het maximum aantal reserveringen bereikt. Een nieuwe reservering is nu niet mogelijk." });
r = await book(US);
check("Cineville maximum reached: failed for good, in plain words, without the pass number", r.status === "failed" && r.final && /maximum number of bookings/.test(r.reason) && !r.reason.includes("111111111") && shop.orders.length === 0, r.reason);
reset({ error: "Reserveren met pasnummer CP$111111111 is momenteel niet mogelijk. Neem contact op met de Cineville Klantenservice." });
r = await book(US);
check("Pass blocked by Cineville: failed for good, says to ask Cineville", r.status === "failed" && r.final && /customer service/.test(r.reason), r.reason);

reset({ soldout: true });
r = await book(US);
check("Sold out by the time it opens the page: soldout, nothing tried", r.status === "soldout" && shop.baskets.length === 0);
reset({ when: "do 05 november 2026, 18:40 - LAB 4" });
r = await book(US);
check("Another screening's page: not touched", r.status === "failed" && r.retry && shop.baskets.length === 0, r.reason);
reset({ max: 1 });
r = await book(US);
check("Only one seat on offer: doesn't book half, will retry", r.status === "failed" && r.retry && /won't sell 2/.test(r.reason) && shop.baskets.length === 0, r.reason);
reset({ cineville: false });
r = await book(US);
check("No Cineville tickets on offer (for now): failed, will retry", r.status === "failed" && r.retry && !r.final && /doesn't offer Cineville/.test(r.reason), r.reason);

reset({ after: "pay" });
r = await book(US);
check("Sent to a payment page after ordering: stops there and says so", r.status === "failed" && r.final && /localhost/.test(r.reason) && /payment/.test(r.reason), r.reason);
reset({ after: "nothing" });
r = await book(US);
check("No confirmation to read: unclear, try again (the shop won't book the same passes twice)", r.status === "unclear" && r.retry, r.status);

reset();
r = await book({ ...US, dryRun: true });
check("Test run: fills everything in, stops before ordering and gives the seats back", r.status === "ready" && shop.orders.length === 0 && shop.baskets.length === 2 && shop.baskets[1].quantity === 0 && isPng(r.shot), JSON.stringify(shop.baskets));
reset();
r = await book({ ...US, ticket: "Regulier", passes: [], count: 1, dryRun: true });
check("Test run with a paid ticket type (no passes): reaches the order button, orders nothing", r.status === "ready" && shop.orders.length === 0, r.reason);

const saved = process.env.PLAYWRIGHT;
process.env.PLAYWRIGHT = "/nowhere/playwright-core";
r = await book(US);
process.env.PLAYWRIGHT = saved;
check("No browser available: failed, will retry, says why", r.status === "failed" && r.retry && /couldn't start the browser/.test(r.reason), r.reason);

server.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
