# Ticket alert

A Telegram message the moment tickets open up for the sold-out screening of **Pulse** at the Imagine Film Festival: Sunday 1 November 2026, 18:35, LAB111, with the director's Q&A. It has nothing to do with the website; it only lives in this repository.

- `.github/workflows/ticket-alert.yml` runs every 5 minutes on GitHub Actions; each run checks about once a minute for 4 minutes.
- `watch.mjs` reads LAB111's ticket shop (show 1312105). A sold-out show carries a SOLD OUT label; a show on sale has the ticket table. If the shop can't be read, it falls back to the festival page's row for the screening.
- Messages: a welcome, an alert with the ticket link (repeated every 10 minutes while tickets stay on sale), "sold out again", a warning if the pages can't be read for 15 minutes, a daily "still watching" at 10:00, and a goodbye when the screening starts. Then it switches its own workflow off.
- Telegram commands: `/status`, `/stop` (pause alerts), `/start` (resume). It only answers our own chat.
- Its memory is `state.json` on the `ticket-alert-state` branch.
- Tests: `node .github/ticket-alert/watch.test.mjs`.

## Setup (about 6 minutes)

1. In Telegram, open **@BotFather**, send `/newbot`, pick a name and a username ending in `bot`. It replies with a token.
2. Open the new bot from BotFather's link and press **Start** (a bot can only message people who started it).
3. Open **@userinfobot** and press **Start**: it replies with your Id (a number).
4. In this repository on GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add `TELEGRAM_BOT_TOKEN` (the token) and `TELEGRAM_CHAT_ID` (the Id).

The next run (within 5 minutes) sends "Ticket alert is on". To run it right away: **Actions → Ticket alert → Run workflow**.
