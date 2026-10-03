# Ultra Mega Ultimate Date Planner

A shared, ranked list for two: films to watch, dishes to cook, and things to do together.

- `index.html` — the whole site (no build step).
- `firebase-config.js` — the Firebase settings that turn on the shared lists.
- `firestore.rules` — the database rules: who can read and write, and what an item may contain.
- `PROMPT.md` — the prompt the site was built from.

## How sharing works

Once Firebase is connected (step 2 below), the plain address, https://ultramegaultimatedateplanner.github.io, is one shared list. Anyone who opens it sees and edits the same lists, live. **Share the list** on the page copies that link.

Items added before Firebase was connected are saved only in the browser they were added in. The first time each browser opens the shared list, it copies its own items in automatically, skipping any title the list already has, and it never imports them again after that.

Want a separate list for something else? Add `?club=` and 8–40 letters or digits to the address, e.g. `https://ultramegaultimatedateplanner.github.io/?club=ourtrip2027`.

## Setup (one time, about 10 minutes)

### 1. The site is online

GitHub Pages publishes this repository automatically at https://ultramegaultimatedateplanner.github.io whenever `main` changes. Until step 2 is done, the site works but saves lists only in the browser you use.

### 2. Turn on the shared lists (Firebase, free plan)

1. Go to https://console.firebase.google.com and click **Create a project**. Any name works. You can turn Google Analytics off.
2. In the left menu, open **Build → Firestore Database** and click **Create database**. Pick a location near you, choose **Start in production mode**, and click **Create**.
3. Open the **Rules** tab, replace everything there with the contents of `firestore.rules`, and click **Publish**.
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

Anyone who opens the site can read and change the shared lists, so share the address only with people you'd hand a shared notebook to. The rules block everything else: nobody can list other `?club=` codes, and items must have the expected shape (a title of up to 140 characters, a note of up to 400, and an optional web link).
