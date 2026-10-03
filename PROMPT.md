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
