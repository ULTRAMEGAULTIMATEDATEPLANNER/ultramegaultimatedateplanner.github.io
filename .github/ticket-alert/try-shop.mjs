// Practice run of buy.mjs on LAB111's real shop, for a screening that is on sale. It never orders:
// 1. Cineville × 2 with made-up pass numbers: the shop should turn them down, and buy.mjs should say so.
// 2. One regular ticket with a made-up name and email: it fills everything in up to the order
//    button, stops there and gives the seat back.
// Usage: node .github/ticket-alert/try-shop.mjs <LAB111 show number> [folder for screenshots]
import { writeFileSync, mkdirSync } from "node:fs";
import { book } from "./buy.mjs";

const show = process.argv[2], out = process.argv[3] || ".";
if (!/^\d+$/.test(show || "")) { console.log("Give the LAB111 show number of a screening that is on sale."); process.exit(2); }
mkdirSync(out, { recursive: true });
const url = `https://tickets.lab111.nl/labcinema/nl/flow_configs/webshop/steps/start/show/${show}`;
const page = await (await fetch(url, { headers: { "accept-language": "nl" } })).text();
const when = /id=['"]show-starts-at['"]>([^<]*)</.exec(page);
if (!when) { console.log("That screening isn't on LAB111's shop."); process.exit(2); }
const expect = when[1].replace(/^\w+\s+/, "").replace(/\s+-.*$/, "");
console.log(`Screening: ${when[1]}`);

let ok = true;
const fake = { url, expect, email: "practice-run@example.org", lastName: "Practice", dryRun: true };
const a = await book({ ...fake, passes: ["CP$000000001", "CP$000000002"] });
if (a.shot) writeFileSync(`${out}/1-made-up-passes.png`, a.shot);
console.log(`1. Made-up passes: ${a.status} – ${a.reason}`);
if (!(a.status === "failed" && /didn't take the tickets/.test(a.reason))) ok = false;
const b = await book({ ...fake, ticket: "Regulier", count: 1 });
if (b.shot) writeFileSync(`${out}/2-filled-in.png`, b.shot);
console.log(`2. Regular ticket, filled in up to the order button: ${b.status} – ${b.reason}`);
if (b.status !== "ready") ok = false;
console.log(ok ? "Practice run OK: nothing was ordered." : "Practice run did NOT go as expected (nothing was ordered).");
process.exit(ok ? 0 : 1);
