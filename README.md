# Ultra Mega Ultimate Date Planner

A shared, ranked list for two: films to watch, dishes to cook, things to do together, and a log of the restaurants you've been to, with your own reviews and a map.

- `index.html` — the whole site (no build step).
- `firebase-config.js` — the Firebase settings that turn on the shared lists.
- `firestore.rules` — the database rules: who can read and write, and what an item may contain.
- `PROMPT.md` — the prompt the site was built from.
- `tests/parse-maps-link.test.mjs` — checks the Google Maps link reader (`node tests/parse-maps-link.test.mjs`).

## How sharing works

Once Firebase is connected (step 2 below), the plain address, https://ultramegaultimatedateplanner.github.io, is one shared list. Anyone who opens it sees and edits the same lists, live. **Share the list** on the page copies that link.

Items added before Firebase was connected are saved only in the browser they were added in. When that browser opens the shared list, it copies those items in automatically. It skips anything the list already has (same title, both to-do or both done) and copies each item only once. Separate `?club=` lists never receive them.

Want a separate list for something else? Add `?club=` and 8–40 letters or digits to the address, e.g. `https://ultramegaultimatedateplanner.github.io/?club=ourtrip2027`.

## The Restaurants tab

The fourth tab is a log of places you two have eaten, not a ranked list.

- **Adding a place:** type its name and press Enter. Pasting the place's Google Maps link fills in the name and pins it on the exact spot; a "Pinned ✓" chip confirms it. Short share links (`maps.app.goo.gl/…`) can't be read in a browser, so for those tap **Tap the map to place it**, paste coordinates like `51.92031, 4.48712`, or pick a city (that pins it to the city centre, marked approximate).
- **Reviews:** each of you gives 1–5 stars and a few words, shown under your own name. The first review on a phone asks who you are once; **Us** changes your names. The score is the average of your stars, and two people reviewing at the same moment never overwrite each other.
- **Medals:** Gold 4.5–5.0 (Go back. Bring people.), Silver 3.75–4.49, Bronze 3.0–3.74, Ash 2.0–2.99, Black below 2.0 (Never again), or Unrated. Cards and map pins use the same colours and always show the score as text.
- **The map:** scroll down for a map of the Netherlands with a pin per place, coloured by medal. Tap a pin for its ticket, with **Open in Google Maps** and **Show in the list**. On a phone one finger scrolls the page and two fingers move the map. The map is OpenStreetMap's (free, credited on the map; CARTO's tiles now require an API key). Offline, the list and reviews still work and the map says it needs a connection.
- Nothing here uses a Google API or key: "Google Maps" means each place links to its own Google Maps page.

Where it's stored: `clubs/{club}/restaurants/{place}` and your names in `clubs/{club}/meta/people`. Without Firebase, they stay in the browser (`someday-club:restaurants:v1`, `someday-club:people:v1`).

## Setup (one time, about 10 minutes)

### 1. The site is online

GitHub Pages publishes this repository automatically at https://ultramegaultimatedateplanner.github.io whenever `main` changes. Until step 2 is done, the site works but saves lists only in the browser you use.

### 2. Turn on the shared lists (Firebase, free plan)

1. Go to https://console.firebase.google.com and click **Create a project**. Any name works. You can turn Google Analytics off.
2. In the left menu, open **Build → Firestore Database** and click **Create database**. Pick a location near you, choose **Start in production mode**, and click **Create**.
3. Open the **Rules** tab, replace everything there with the contents of `firestore.rules`, and click **Publish**. Do this again whenever `firestore.rules` changes (it did when the Restaurants tab was added); until then the tab says it needs the updated rules.
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

Anyone who opens the site can read and change the shared lists, so share the address only with people you'd hand a shared notebook to. The rules block everything else: nobody can list other `?club=` codes, and every record must have the expected shape: list items (a title of up to 140 characters, a note of up to 400, an optional web link), restaurants (a name of up to 120 characters, a city of up to 60, only Google Maps links, coordinates in range, 1–999 visits, and reviews of 1–5 whole stars with up to 600 characters each, for just the two of you) and your two names (up to 24 characters each).
