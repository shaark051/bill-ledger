# Household Bills

Simple household bill tracker and splitter (Current Version: `v3.5.0`).

Access live app here: https://bill-ledger.sharierarko-business.workers.dev

## Project Structure

```text
.
├── index.html           # Main bill ledger page
├── archive.html         # Archived bills page
├── participants.html    # Participant management page
├── CHANGELOG.md         # Release history and release notes
├── package.json         # Project metadata and versioning
├── src/
│   ├── css/
│   │   └── styles.css   # Global application styles
│   └── js/
│       ├── app.js       # Main ledger UI logic & state interactions
│       ├── archive.js   # Archive page UI logic
│       ├── data.js      # Data models, shares calculator & Firebase sync
│       └── participants.js # Participants page UI logic
```

## Setup & Deployment

1. Configure your Firebase Realtime Database in `src/js/data.js` under `firebaseConfig`.
2. Deploy `index.html`, `archive.html`, `participants.html`, and the `src/` directory to your static host (e.g. Cloudflare Pages).
