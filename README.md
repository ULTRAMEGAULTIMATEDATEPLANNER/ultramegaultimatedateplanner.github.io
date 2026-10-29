# Ultra Mega Ultimate Date Planner

A shared, ranked list for two: films to watch, dishes to cook, things to do together, and a log of the restaurants you've been to, with your own reviews and a map.

- `index.html` — the whole site (no build step).
- `firebase-config.js` — the Firebase settings that turn on the shared lists.
- `google-config.js` — optional Google Maps key for restaurant photos (off until a key is added).
- `firestore.rules` — the database rules: who can read and write, and what an item may contain.
- `PROMPT.md` — the prompt the site was built from.
- `tests/parse-maps-link.test.mjs` — checks the Google Maps link reader (`node tests/parse-maps-link.test.mjs`).

## The four looks

Each tab dresses like a famous app of its kind, with the zine's grain, specks, tape and halftone kept as a mixed-media layer:

- **Films → MUBI.** Black and white, uppercase type in two weights, one cobalt-blue accent, square corners. Every film gets a generated "still" (a duotone frame with grain and vignette, picked from its title); #1 is the hero, in a strip of film with sprocket holes and "Up next" on it. Watched films become ticket stubs.
- **Dishes → a printed newspaper.** Yellowed newsprint with grain and a centre fold, a blackletter nameplate with the motto "All the Dishes That Are Fit to Cook" and an edition line with today's date, serif headlines with italic decks, rules between stories, and the add form as a clip-out coupon. Every dish gets a generated overhead plate printed in halftone; #1 is the lead story, with a red-pencil circle, a drop cap and a strip of tape. Cooked dishes become clippings with a red COOKED stamp.
- **A photo of what you cooked.** After "Cooked it", the message offers **Add a photo** (also on each clipping: **Add a photo** / **Change photo**). The photo is taken or chosen on the phone, made into the same small JPEG as restaurant photos, stored in the same place (`clubs/{club}/photos/{dishId}`, so no new database rules), and printed on the page in black-and-white halftone. Removing the dish for good removes its photo; Undo brings both back.
- **Together → the riso zine** (the original look).
- **Restaurants → Letterboxd** (below).

Switching between looks plays the pixel shuffle (about 1.5 s; skipped with reduced motion). The phone's bar colour follows each look.

## How sharing works

Once Firebase is connected (step 2 below), the plain address, https://ultramegaultimatedateplanner.github.io, is one shared list. Anyone who opens it sees and edits the same lists, live. **Share the list** on the page copies that link.

Items added before Firebase was connected are saved only in the browser they were added in. When that browser opens the shared list, it copies those items in automatically. It skips anything the list already has (same title, both to-do or both done) and copies each item only once. Separate `?club=` lists never receive them.

Want a separate list for something else? Add `?club=` and 8–40 letters or digits to the address, e.g. `https://ultramegaultimatedateplanner.github.io/?club=ourtrip2027`.

## The Restaurants tab

The fourth tab is a log of places you two have eaten, not a ranked list. It has its own look, modelled on Letterboxd in purple and green: the whole page turns dark purple, the four tabs become a slim nav, and the tab shows a profile row (your names, places, this year, reviews, average), the four most recent places as generated posters, a ratings histogram, the log form and a diary of reviews with green stars. Switching to or from it plays a 1.5-second pixel shuffle: the page breaks into blocks of its own colours, which fly in a wave from the tapped tab to wherever the new page needs that shade and dissolve into it (skipped when the phone asks for reduced motion). The other three tabs keep the riso zine.

- **Adding a place:** start typing its name and pick it from the list of restaurants that appears. That fills in the name and city, pins it on its exact spot and links it to that place in Google Maps; a line under the box confirms the address, and **Not this one** brings the list back. Pressing Enter without picking adds it by name only.
- **Other ways to pin it:** pasting the place's Google Maps link fills in the name and pins it on the exact spot; a "Pinned ✓" chip confirms it. Short share links (`maps.app.goo.gl/…`) can't be read in a browser, so for those tap **Tap the map to place it**, paste coordinates like `51.92031, 4.48712`, or pick a city (that pins it to the city centre, marked approximate).
- **The restaurant search** looks in OpenStreetMap's list of restaurants, cafés, bars and snack places, through Photon (photon.komoot.io), a free search with no account or key. Dutch places come first, but places abroad turn up too. A place that isn't in OpenStreetMap yet can still be added by name or link.
- **Reviews:** each of you gives ½ to 5 stars (tap the left half of a star for a half, like Letterboxd) and a few words, shown under your own name. The first review on a phone asks who you are once; **Us** changes your names. The score is the average of your stars, and two people reviewing at the same moment never overwrite each other.
- **Medals:** Gold 4.5–5.0 (Go back. Bring people.), Silver 3.75–4.49, Bronze 3.0–3.74, Ash 2.0–2.99, Black below 2.0 (Never again), or Unrated. Cards and map pins use the same colours and always show the score as text.
- **The map:** scroll down for a map of the Netherlands with a pin per place, coloured by medal. Tap a pin for its ticket, with **Open in Google Maps** and **Show in the list**. On a phone one finger scrolls the page and two fingers move the map. The map is OpenStreetMap's (free, credited on the map; CARTO's tiles now require an API key). Offline, the list and reviews still work and the map says it needs a connection.
- Nothing here uses a Google API or key: "Google Maps" means each place links to its own Google Maps page (for a place picked from the search, a Google Maps search for its name and address).

### Restaurant photos

Tap any poster for its photo sheet: **Take a photo** (opens the camera on a phone), **Choose a photo**, **Remove our photo**, and, on a Google photo, **Not this place's photo**. A photo you add is cropped to the 2:3 poster, shrunk to a 360×540 JPEG (about 100 kB), and shared with your partner. It always replaces Google's photo.

With a Google Maps key in `google-config.js`, posters also show the place's own Google Maps photo:

- When a place is logged (and once for places logged earlier), the app runs one "name, city" search near its pin, asking Google only for the place's ID (its cheapest search), and keeps that ID. Google allows keeping IDs, not photos.
- Each photo is looked up fresh, only when its poster comes into view, and is credited under the poster ("Photo: author · Google Maps"). Each phone makes at most 150 Google calls a day. If Google picks the wrong place, **Not this place's photo** remembers that.
- Without a key nothing is sent to Google.

To turn Google photos on (about 15 minutes):

1. Open https://console.cloud.google.com, sign in, and create a new project (project picker at the top → **New project**).
2. **Billing** → link a billing account and add a card. Google requires one even though light use falls within its free monthly allowance.
3. Open https://console.cloud.google.com/apis/library/places.googleapis.com and click **Enable** (this is "Places API (New)").
4. Open https://console.cloud.google.com/apis/credentials → **Create credentials → API key**, then edit the key: under **Application restrictions** choose **Websites** and add `https://ultramegaultimatedateplanner.github.io/*`; under **API restrictions** choose **Restrict key** and tick **Places API (New)**. Save.
5. Optional but wise: open the API's **Quotas** page and lower the per-day limits (for example 200 a day each), so usage can never grow past them.
6. Put the key in `google-config.js` (replace `null` with the key in quotes). Like every website key it is visible in the page; the restrictions from step 4 are what protect it.

Where it's stored: `clubs/{club}/restaurants/{place}`, your names in `clubs/{club}/meta/people`, your photos in `clubs/{club}/photos/{place}` and Google matches in `clubs/{club}/gplace/{place}`. Photos are kept apart from the list, so the list stays light; if the database rules haven't been updated yet, only photos are off. Without Firebase, they stay in the browser (`someday-club:restaurants:v1`, `someday-club:people:v1`, `someday-club:photos:v1`, `someday-club:gplace:v1`).

## Setup (one time, about 10 minutes)

### 1. The site is online

GitHub Pages publishes this repository automatically at https://ultramegaultimatedateplanner.github.io whenever `main` changes. Until step 2 is done, the site works but saves lists only in the browser you use.

### 2. Turn on the shared lists (Firebase, free plan)

1. Go to https://console.firebase.google.com and click **Create a project**. Any name works. You can turn Google Analytics off.
2. In the left menu, open **Build → Firestore Database** and click **Create database**. Pick a location near you, choose **Start in production mode**, and click **Create**.
3. Open the **Rules** tab, replace everything there with the contents of `firestore.rules`, and click **Publish**. Do this again whenever `firestore.rules` changes (it did when the Restaurants tab and its photos were added); until then the tab says it needs the updated rules.
4. Click the gear icon, then **Project settings**. Under **Your apps**, click the web icon (`</>`), give it any nickname, and click **Register app**. Leave Firebase Hosting unticked.
5. Copy the `firebaseConfig = { … }` values it shows into `firebase-config.js`, like this:

```js
window.SOMEDAY_FIREBASE_CONFIG = {
  apiKey: "…",
  authDomain: "….firebaseapp.com",
  projectId: "…",
  storageBucket: "….firebasestorage.app",
  messagingSenderId: "…",
  appId: "…"
};
```

Commit the change to `main`. GitHub Pages republishes on its own. These values are safe to be public; `firestore.rules` is what protects the data.

## Privacy

Anyone who opens the site can read and change the shared lists, so share the address only with people you'd hand a shared notebook to. What you type in the Restaurants name box (from the third letter on) is sent to Photon to search; nothing else is. The rules block everything else: nobody can list other `?club=` codes, and every record must have the expected shape: list items (a title of up to 140 characters, a note of up to 400, an optional web link), restaurants (a name of up to 120 characters, a city of up to 60, only Google Maps links, coordinates in range, 1–999 visits, and reviews of ½ to 5 stars in half steps with up to 600 characters each, for just the two of you), photos (one JPEG of up to 200 kB per place, nothing else), Google matches (a place ID or "-") and your two names (up to 24 characters each). With a Google key, the restaurant's name and city (and, for posters on screen, its Google place ID) are sent to Google to find its photo.
