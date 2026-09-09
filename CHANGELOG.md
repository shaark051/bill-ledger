# v3.0 — Redesign & Archive

**Previous version:** v2.1

## Redesign
- Full visual overhaul: replaced the green/cream/beige theme with a white, blue, and grey palette inspired by Apple's own apps (grouped lists, hairline dividers, system blue accents, SF-style type).
- Restyled every button, chip, status pill, and form field to match.
- Split the single `index.html` file into `index.html`, `archive.html`, `styles.css`, `data.js`, `app.js`, and `archive.js` for easier maintenance. Upload all six files together to the same folder on Cloudflare Pages.

## New
- **Archive page** (`archive.html`) — archive a bill instead of deleting it. Archived bills are hidden from the main ledger and totals, and can be restored or permanently deleted from the new Archive tab.
- **Sort paid bills to the bottom** — new toggle on the ledger that pushes fully-settled bills (vendor paid + everyone reimbursed) to the end of the list.

## Changed
- Renamed "Split between" to "Participants" and moved it out of the header — it now lives in a collapsible section near the bottom of the ledger, above "Add a bill".

## Notes
- Your Firebase config and data are untouched — same backend, same data path.
