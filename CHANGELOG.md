# Changelog

## v3.2 — Participants page, higher limit, fixed save flow

**Previous version:** v3.1

### New
- **Participants page** (`participants.html`) — add, rename, or remove anyone from your household/friend group from its own page, reached via the "Participants" row on the ledger. You can now remove any individual person, not just the last one added.
- Participant limit raised from **8 to 1000**, so splitting bills with a big friend group or trip isn't an issue.

### Fixed
- **Saving a bill (or renaming a participant) now updates the screen immediately.** Previously, hitting Save appeared to do nothing until you also hit Cancel — the data was actually saving correctly the whole time, but the screen didn't refresh until Cancel was clicked. A small "Saved" confirmation now also pops up briefly so it's obvious the change went through.

### Changed
- The old collapsible "Participants" section on the ledger is gone — it's now a single link row that takes you to the new Participants page.

### Notes
- New file this release: `participants.js` (plus `participants.html`). Upload all 8 files together: `index.html`, `archive.html`, `participants.html`, `styles.css`, `data.js`, `app.js`, `archive.js`, `participants.js`.

---

## v3.1 — Cleaner bill rows

**Previous version:** v3.0

### Changed
- People not part of a bill no longer appear on that bill at all — previously they showed up crossed out; now they're left off the chip row entirely, so you only ever see who's actually involved.

---

## v3.0 — Redesign & Archive

**Previous version:** v2.1

### Redesign
- Full visual overhaul: replaced the green/cream/beige theme with a white, blue, and grey palette inspired by Apple's own apps (grouped lists, hairline dividers, system blue accents, SF-style type).
- Restyled every button, chip, status pill, and form field to match.
- Split the single `index.html` file into `index.html`, `archive.html`, `styles.css`, `data.js`, `app.js`, and `archive.js` for easier maintenance. Upload all six files together to the same folder on Cloudflare Pages.

### New
- **Archive page** (`archive.html`) — archive a bill instead of deleting it. Archived bills are hidden from the main ledger and totals, and can be restored or permanently deleted from the new Archive tab.
- **Sort paid bills to the bottom** — new toggle on the ledger that pushes fully-settled bills (vendor paid + everyone reimbursed) to the end of the list.

### Changed
- Renamed "Split between" to "Participants" and moved it out of the header — it now lives in a collapsible section near the bottom of the ledger, above "Add a bill" (later replaced by the dedicated Participants page in v3.2).

### Notes
- Firebase config and data untouched from v2.1 — same backend, same data path.

---

## v2.1 and earlier

Prior history predates this changelog file. v2.1 was a single-file (`index.html`) app with a green/cream/beige theme, hybrid split mode (fixed amounts + even split of the remainder), and per-bill participant selection.
