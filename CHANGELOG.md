# Changelog

## v3.5 — Fixed drag-to-reorder not appearing

**Previous version:** v3.4

### Fixed
- **Drag handles were invisible by default.** Dragging only works when both "Paid to bottom" and "Group by category" are switched off — but "Paid to bottom" defaults to **on**, so on a fresh load the drag handles never showed up at all, which looked like the feature just didn't work. The handle now always shows on every bill; when sorting is active it's greyed out with a tooltip explaining why, and a visible banner above the list says "Turn off both sorting toggles above to drag bills into your own order." Turn both toggles off and the handles light up and work normally.
- Hardened the drag code to clean up properly if a drag gets interrupted mid-gesture (e.g. the OS momentarily steals the touch) — previously this could leave a row stuck in a half-dragged state.

---

## v3.4 — Drag to reorder, quick-add participants

**Previous version:** v3.3

### New
- **Drag to reorder bills** — a grip handle on the left of each bill lets you drag it into your own custom order (works with touch on mobile, not just mouse on desktop). Only available when "Paid to bottom" and "Group by category" are both off, since either of those already imposes its own order — a small hint appears when that's the case.
- **Add a participant straight from the bill form** — while adding or editing a bill, a new "Add someone new to this bill" field in the split editor lets you add a person on the spot instead of visiting the Participants page first.

### Changed
- People added via the bill form default to **only being included on that bill** — they won't automatically show up checked on your other existing bills, unlike people added from the Participants page (who still default to included everywhere, as before). This is meant for splitting a one-off bill with someone outside the household without them cluttering every other bill. They're still a full participant afterward — you can include them on other bills anytime, or remove them entirely from the Participants page when you're done.

### Notes
- The 1000-person cap applies to quick-add too, same as the Participants page.

---

## v3.3 — Categories

**Previous version:** v3.2

### New
- **Bill categories** — assign a category to any bill from the add/edit form (e.g. Utilities, Rent, Groceries). Manage the category list (add or remove) from a small panel above the bill list — tap the gear icon next to the filter chips.
- **Filter by category** — a row of chips ("All", "Uncategorized", plus each category you've added) filters the bill list to just that category. Totals at the top update to match whatever's currently filtered.
- **Group by category** — a toggle (shown when viewing "All") sorts the list by category name, with "Paid to bottom" still applied within each group if that's also on.

### Notes
- Existing bills without a category just show as "Uncategorized" — no migration needed, nothing breaks.
- Removing a category doesn't touch the bills that used it — they just drop back to Uncategorized.

---

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
