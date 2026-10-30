# Engineered prompt: Someday Club

The original request:

> Make a website for my partner and me. Three tabs: films we want to watch (in an order of priority we set), dishes we want to cook, and things we want to do together. Make it easy to add new items. Design: very cool, with gritty graphic-design textures.

The prompt below is the expanded version that was used to build `index.html`.

---

## Role

You are a product designer and front-end engineer at a small, opinionated studio. You ship one polished, production-quality web page. Make deliberate design decisions and avoid generic or templated output.

## What to build

**Someday Club** is a shared list site for a couple. It has three tabs, and each tab is one ranked list:

| Tab | List | "Done" means | Stamp |
|---|---|---|---|
| Films | films to watch | Watched it | WATCHED |
| Dishes | dishes to cook | Cooked it | COOKED |
| Together | things to do as a pair | Did it | DONE IT |

## Who uses it and what they need

- Two people on their own phones and laptops, often on the sofa or in the supermarket.
- They need to add an idea in a couple of seconds, before they forget it.
- They need to agree on what comes first. Order matters, so the list is ranked, not sorted by date.
- Both people must see the same list, live. If the list lives in only one browser, the site has failed.

## Functional requirements

1. **Three tabs**, deep-linkable (`#films`, `#dishes`, `#together`). The page remembers the last tab per viewer. Tabs support arrow-key navigation (WAI-ARIA tabs pattern).
2. **Adding must be the easiest action.** An input is always visible at the top of each list. Enter adds the item. "Add a note or link" is an optional extra. A "Put it at #1" checkbox makes the new item top priority; otherwise it goes to the bottom.
3. **Priority ranking**:
   - Numbered ranks. #1 gets an "Up next" sticker.
   - Re-rank by dragging a grip. This must work with both mouse and touch, using pointer events, not HTML5 drag-and-drop.
   - Up and down buttons do the same job for keyboard and accessibility.
   - Store ranks as fractional numbers, so a move rewrites one record, not the whole list. Re-number everything if the gaps get too small.
4. **Edit inline**: title, note and link. Escape cancels.
5. **Mark done**: the item moves to a collapsible "pile" with a rubber-stamp mark and the date. "Put back" returns it to the list.
6. **Delete with an Undo toast.** Never use `confirm()`.
7. **"Pick one for us"** spins through the list and lands on a random item, weighted toward the top. It respects reduced motion.
8. **Shared and live**: use a realtime document store so both partners see changes instantly. Show a "who added this" avatar for each item. Show a status chip ("Shared · live" / "View only" / "Saved in this browser").
9. **Graceful fallback**: with no shared store (e.g. the file is opened on its own), keep everything in `localStorage` and say so plainly.
10. **Safety**: treat stored data as untrusted. Render text with `textContent` only, allow only http(s) links, and cap the length of every field.

## Data model

One collection per list (`films`, `dishes`, `together`). Each record has:
`{ title, note, link, rank:number, done:boolean, doneAt:ms|null, addedBy:userId|null, createdAt:ms }`

## Visual direction: gritty, but cool

The concept is a **risograph-printed zine for two**. Draw the textures from real print processes, and build every one of them in code. Use no image files.

- **Spot inks**: one riso ink per tab. Fluorescent Pink for films, Yellow for dishes, Green for together, all on toner black. Accents are used only as fills, with dark text on top, so they stay readable in both themes. The active tab's ink recolors the whole page.
- **Misregistration**: the masthead is printed twice, a black plate plus an offset ink plate blended with multiply (screen in dark mode). On load, the ink plate slides into register. Rank numbers carry an offset ink shadow.
- **Paper grain and toner specks**: full-page SVG `feTurbulence` noise overlays.
- **Worn ink**: noise masks knock holes in big type and stamps. An SVG displacement filter roughens their edges.
- **Halftone**: dot-screen circles in the masthead and empty states.
- **Print details**: masking tape holding the list sheet down, a ticket-perforation divider, a registration mark, an ink key in the footer, rubber stamps on finished items, and hard offset shadows in the tab's ink.
- **Type**: Dela Gothic One for display, Archivo (variable width) for the UI, and Special Elite (typewriter) for labels and metadata.
- **Copy has character**: e.g. empty states read "The reel is empty", "Nothing on the stove", "Calendar's wide open".

## Constraints

- A single self-contained HTML file with no build step. Load fonts from Google Fonts only.
- Mobile-first. It must work at 400px wide with no horizontal scroll, and touch targets must be at least 40px.
- Light and dark themes, built from color tokens. Both themes get the same care.
- Visible focus states, `prefers-reduced-motion` respected, and form controls with stable `id`s.
- No `alert`, `confirm` or `prompt` dialogs.

## Acceptance checklist

- [ ] Adding an item takes one field and Enter.
- [ ] Dragging re-ranks on a phone. Arrow buttons re-rank by keyboard.
- [ ] Partner A's change appears on partner B's screen without a reload.
- [ ] Done items leave the ranked list but are never lost. Delete can be undone.
- [ ] Looks deliberate and gritty in both light and dark, at 400px and 1280px.

---

## Restaurants tab

The request, in the owner's words:

> Add one more tab where you put all the restaurants we have been to (we can add them manually, also connected to Google Maps, we can add the Google Maps link) and then we can leave a review on the app. If you scroll down that new tab, I want to see a map of the Netherlands where we see pinpointed all the restaurants we have been to; depending on the stars we gave the restaurant the pins have different colours: gold is the best, black is bad, everything in between is up to you.

What was built from it:

- **A fourth tab, Restaurants ("we've been to")**, deep-linkable as `#restaurants`, in its own riso spot ink, blue `#5AA9F5`, the complement of the gold and bronze pins. Tabs sit 2×2 below 560 px and in one row above. It reuses the sheet, buttons, toasts, stamps and textures; it is a log, not a ranked list.
- **Fast manual adding:** name, an optional Google Maps link, the date (today by default) and an optional city. `parseMapsLink()` reads coordinates from the place's own pin (`!3d…!4d…`), the map centre (`@lat,lng`), query parameters or plain `lat, lng` text, and the name from `/maps/place/<Name>/`. It never calls Google. Short links can't be resolved in a browser, so the tab offers tapping the map, pasting coordinates, or a city centre (marked approximate). It is covered by `tests/parse-maps-link.test.mjs`.
- **Reviews in the app, never on Google:** two people, named once in "Us"; each device remembers which one it is. Each gives 1–5 whole stars (a radio group) and up to 600 characters, saved by field path (`reviews.a` / `reviews.b`) so simultaneous reviews never overwrite each other. The score is the mean to one decimal. "We went again" counts visits.
- **Medal scale:** Gold 4.5–5.0 "Go back. Bring people.", Silver 3.75–4.49 "Would go again", Bronze 3.0–3.74 "Fine. Genuinely fine.", Ash 2.0–2.99 "Only if it's raining", Black below 2.0 "Never again", and Unrated as a hollow blue ring. Colour is never the only signal: pins and chips carry the score.
- **The map:** Leaflet 1.9.4 with leaflet-gesture-handling 1.2.2 (pinned, with SRI), on OpenStreetMap tiles printed as grey ink on paper (inverted in dark mode). CARTO was the original plan, but it now watermarks keyless requests and the brief rules out keys. It opens on the Netherlands, has "Fit our pins", and SVG drop pins with ticket-style popups built from DOM nodes. On phones one finger always scrolls the page and two fingers move the map. With no connection the map says so and the list keeps working.
- **Data and rules:** `clubs/{club}/restaurants/{place}` and `clubs/{club}/meta/people`, with `validPlace`/`validPeople` in `firestore.rules`. Existing rules are unchanged. Without Firebase, data lives in `someday-club:restaurants:v1` / `someday-club:people:v1`.

### Follow-up: find the restaurant by name

> What if you make it so I can look up the exact restaurant directly there, without having to add the Google Maps link?

- The name box became a search (an ARIA combobox): from three letters, after a 300 ms pause, it asks Photon (photon.komoot.io, OpenStreetMap data, free and keyless) for restaurants, cafés, fast food, bars, pubs, ice cream, food courts and beer gardens, leaning towards the middle of the Netherlands, with Dutch places listed first. Up to six results show name, type and address, as text only.
- Picking one fills in the name and city (`'s-Gravenhage` becomes Den Haag), pins the exact spot and stores a Google Maps search link for its name and address as `mapsUrl`, so the card's "Open in Google Maps" lands on that place. No Google API is called, and the data model and rules are unchanged.
- A pasted link with coordinates still wins; a short link keeps the picked spot. Enter without picking adds by name, as before. Arrow keys, Enter and Escape work; a tap elsewhere closes the list, but putting the phone keyboard away doesn't. Answers that arrive late are dropped, results are remembered for the session, and offline or failed searches say so while adding by name keeps working.

### Follow-up: a Letterboxd look for Restaurants

> Make the restaurant reviews more like the Letterboxd UI: pressing Restaurants changes everything drastically, with a smooth pixelated transition where all the pixels get reassorted into the new Letterboxd interface. Purple with green; the transition lasts about 1.5 seconds.

- While Restaurants is open, `html[data-skin="lb"]` reskins the whole page: dark purple (#14101C, panels #1D1729, lines #3A2F52, lavender-grey text), green (#00E054) stars and primary buttons, purple links and focus rings, Source Serif 4 for titles, no paper grain. The masthead becomes a logo-dots wordmark bar and the tabs a slim uppercase nav (one row, scrolling sideways on very narrow phones). The browser's theme colour follows.
- The tab: a profile row (two initial avatars, names with "Edit names", stats for places, this year, reviews and average), "Recently eaten" (the four latest visits as generated posters with their average in green stars; a poster jumps to its review), a "Ratings" histogram with the average, the log form ("Log a restaurant", search box with a magnifier), and a diary where each place has a poster, a serif title with the city beside it, the medal as a pill, "Review by NAME ★★★★" lines and light text actions. The map turns purple-dark; pins keep their gold-to-black medals.
- Posters are generated, not fetched: a purple/green gradient and pattern chosen from a hash of the name, the initial as a big watermark, the city on top and the name in serif. All text is set as text.
- The pixel shuffle: on a tap that crosses between the zine and the log, the screen is sampled into ~14–22 px blocks (each block takes the colour of the element under its centre, tinted by text), the old mosaic fades in, the page switches underneath, the new page is sampled the same way, and every old block flies (in a wave from the tapped tab, bursting out and settling in) to the new spot of matching brightness while taking on its colour; all land together and dissolve into the real page. About 1.5 s in total; a second tap finishes the first switch immediately; skipped with reduced motion.

### Follow-up: photos on the posters

> Grab the pictures they have on Google Maps (or their logos) whenever a restaurant is added. Both: Google photos automatically, and our own photos replace them. Clicking a poster lets you upload a photo of the restaurant or take one.

- Tapping a poster opens a photo sheet: Take a photo (`capture="environment"`, phones only), Choose a photo, Remove our photo, Not this place's photo (on Google photos), and Go to the review (from the Recently eaten strip).
- Own photos: centre-cropped to 2:3, 360×540 JPEG under 200 kB, stored in `clubs/{club}/photos/{placeId}` (`{data, at, by}`), apart from the list; rules accept only `data:image/jpeg;base64,…` under 200 000 characters. Deleting a place deletes its photo; Undo restores both.
- Google photos need a Google Maps Platform key (`google-config.js`, restricted to the site and Places API (New)); copying from Google Maps is against Google's terms and blocked in browsers. On logging (and once for older places) an IDs-only Text Search ("name, city" near the pin) finds the place ID, stored in `clubs/{club}/gplace/{placeId}`; IDs may be kept, photos may not, so Place Details (photos only) and the photo media load fresh when a poster comes into view, at most 150 calls per device per day, credited "Photo: author · Google Maps". Google Maps has no separate logo field; its photos are whatever the owner and visitors uploaded.

### Follow-up: half stars, and an app look for every tab

> More like Letterboxd: half stars. The pixel transition is great; give each tab a different style mimicking a famous app of its kind, still very artsy and mixed media. Research which apps would work. (Chosen: MUBI for Films, NYT Cooking for Dishes; no dating app for Together, so it keeps the zine.)

- Half stars: ten radios per review (each star split into a left half N−½ and a right half N, ids `star-N-half` / `star-N`), shown as "★★★★½"; rules accept 0.5–5 in half steps. Until the rules are published a half star is refused with a message and nothing else is blocked.
- Research (App Store ratings, design critiques, brand write-ups): Letterboxd and MUBI lead for film lovers (MUBI: black/white canvases, full-bleed stills, uppercase two-weight type, one cobalt blue, square corners); Netflix's Top 10 row was the alternative. NYT Cooking is the top-rated cooking app (editorial serif, big photos, Recipe Box, ingredient checklists); Pinterest the alternative. For Together, Hinge, Airbnb Experiences and Tinder were offered; the owner preferred to keep the zine.
- `SKIN = { films: "mubi", dishes: "nyt", together: "zine", restaurants: "lb" }` on `html[data-skin]`; shared app chrome (slim header, nav row, flat sheet) plus per-look tokens. Ranked rows gain a decorative `.art` (hidden in the zine): MUBI duotone stills (eight palettes × four compositions from a hash of the title, grain, vignette; the hero in a sprocket strip) and NYT halftone plates (six palettes × four platings on linen). Watched films are ticket stubs; #1 dish gets a red-pen circle and tape. The pixel shuffle plays whenever the look changes.

### Follow-up: Dishes as a real newspaper, with photos of what we cooked

> For the food one make it like newspaper texture and style, and add an option to add a picture of the food after we cook it.

- Dishes moved from the NYT Cooking app look to a printed newspaper (`data-skin="news"`): yellowed newsprint with heavier grain, specks and a centre fold; a blackletter nameplate (UnifrakturMaguntia) with the motto "All the Dishes That Are Fit to Cook" and an edition line ("Vol. I · date · Serves two") between rules; section kicker "Cooking"; serif headlines with italic decks and a red drop cap on the lead; "No. N" ranks with a red-pencil circle on #1; halftone plates; a dashed clip-out coupon for adding; the cooked pile as torn clippings with a red stamp.
- Photos after cooking: the "Cooked it" message offers "Add a photo"; clippings have Add a photo / Change photo. The shared photo sheet now serves restaurants and dishes. Dish photos reuse `clubs/{club}/photos/{itemId}` (same validated JPEG, no rules change) and print in grayscale halftone in the clipping and, if the dish goes back on the list, in its story.

### Follow-up: real film posters, and a grey newspaper without made-up pictures

> Films: take the posters of the films from online once we log or add them, or remove the super 8 image. Dishes: a grayer New York style newspaper (it looked too warm), and no pictures until we add them, shown as an option.

- Films: the generated stills are gone. Posters come from English Wikipedia (MediaWiki API, `generator=search` for "title [year] film", `prop=pageimages|description`, `pilicense=any` so non-free posters are included, `origin=*` for CORS; the first page whose description or title says "film"). The image (upload.wikimedia.org, CORS-enabled) is turned into a 360×540 JPEG and saved in `clubs/{club}/photos/{filmId}`; "no film article" or a poster we removed is remembered as "-" in `gplace/{filmId}`; errors such as a 429 are retried in a later session. The poster sheet offers your own image, Remove the poster, and Find the poster online.
- Dishes: cool grey newsprint (#EDEDE9), black ink, graphite pencil circle; red only on the COOKED stamp. No generated plates: a dashed "Add a photo" frame on #1 and on cooked clippings, a "+ Add a photo" link on the other dishes; photos print in black-and-white halftone.
