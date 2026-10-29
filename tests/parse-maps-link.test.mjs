// Run with: node tests/parse-maps-link.test.mjs
// Checks parseMapsLink() from index.html against the cases the Restaurants tab must handle.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const src = html.split("/* parseMapsLink:start */")[1]?.split("/* parseMapsLink:end */")[0];
if (!src) throw new Error("parseMapsLink markers not found in index.html");
const parseMapsLink = new Function(src + "\nreturn parseMapsLink;")();

const cases = [
  ["https://www.google.com/maps/place/Example+Bistro/@51.9201,4.4858,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d51.92031!4d4.48712", 51.92031, 4.48712, "Example Bistro"],
  ["https://www.google.com/maps/@52.3731,4.8922,15z", 52.3731, 4.8922, null],
  ["https://maps.google.com/?q=52.0907,5.1214", 52.0907, 5.1214, null],
  ["https://www.google.com/maps/search/?api=1&query=51.9225%2C4.47917", 51.9225, 4.47917, null],
  ["https://www.google.nl/maps/place/Caf%C3%A9+X/@52.1,5.1,14z", 52.1, 5.1, "Café X"],
  ["https://maps.app.goo.gl/AbCdEfGh123", null, null, null],
  ["51.92031, 4.48712", 51.92031, 4.48712, null],
  ["http://example.com/maps/@52,5,10z", null, null, null, "That isn't a Google Maps link."],
  // extra guards
  ["https://goo.gl/maps/xyz123", null, null, null],
  ["https://www.google.com/maps/@95.1,4.8,15z", null, null, null],
  ["91, 4", null, null, null, "Those coordinates are out of range."],
  ["http://www.google.com/maps/@52.3731,4.8922,15z", null, null, null, "That isn't a Google Maps link."],
  ["https://www.google.com/search?q=52.1,5.1", null, null, null, "That isn't a Google Maps link."],
  ["https://evilgoogle.com/maps/@52,5,10z", null, null, null, "That isn't a Google Maps link."],
  ["google.com/maps/place/De+Kas/@52.3546,4.9264,17z", 52.3546, 4.9264, "De Kas"],
];

let failed = 0;
for (const [input, lat, lng, name, error] of cases) {
  const r = parseMapsLink(input);
  const ok = r.lat === lat && r.lng === lng && r.name === name && (r.error || undefined) === error;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${input.slice(0, 70)}${input.length > 70 ? "…" : ""}\n      → lat ${r.lat}, lng ${r.lng}, name ${JSON.stringify(r.name)}${r.error ? `, error "${r.error}"` : ""}`);
}
console.log(failed ? `\n${failed} FAILED` : `\nAll ${cases.length} passed`);
process.exit(failed ? 1 : 0);
