/* ============================================================
   SETUP — read this before using
   ============================================================
   This app stores its data in a Firebase Realtime Database so
   everyone in the household sees the same live data from their
   own phone. You need your own free Firebase project:

   1. Go to https://console.firebase.google.com and create a project.
   2. In the project, go to Build > Realtime Database > Create Database.
      Start in "test mode" (fine for a small private household app —
      just don't share the URL publicly).
   3. Go to Project settings (gear icon) > General > "Your apps" >
      click the </> (web) icon to register a web app.
   4. Copy the firebaseConfig object it gives you and paste it below,
      replacing the placeholder values.
   5. Upload index.html, archive.html, styles.css, data.js, app.js and
      archive.js together to your static host (they must all sit in
      the same folder, since the pages reference each other by name).
   ============================================================ */

export const firebaseConfig = {
  apiKey: "AIzaSyCuexcR7Fc-H-H2bOR6TnVcGQU5XS_OGnY",
  authDomain: "bill-splitter-tracker.firebaseapp.com",
  databaseURL: "https://bill-splitter-tracker-default-rtdb.firebaseio.com",
  projectId: "bill-splitter-tracker",
  storageBucket: "bill-splitter-tracker.firebasestorage.app",
  messagingSenderId: "961216833885",
  appId: "1:961216833885:web:d0d284e1d8e2b88d77a0b4",
  measurementId: "G-HC2GWBNR0M"
};

export const DATA_PATH = "billLedger";

/* Practical ceiling on the participant list — high enough that it
   never gets in the way (splitting bills with a big friend group,
   a trip, etc.) while still keeping things sane. */
export const MAX_PARTICIPANTS = 1000;

export const DEFAULT_STATE = {
  people: ["P1", "P2", "P3", "P4"],
  bills: [
    { id: "b1", date: "2026-08-08", name: "Internet", total: 79, vendorPaid: true, participants: [true, true, true, true], personPaid: [true, true, true, false], custom: [null, null, null, null], archived: false },
    { id: "b2", date: "2026-08-24", name: "Electricity", total: 585.33, vendorPaid: false, participants: [true, true, true, true], personPaid: [false, false, false, false], custom: [null, null, null, null], archived: false },
    { id: "b3", date: "", name: "Gas", total: 0, vendorPaid: false, participants: [true, true, true, true], personPaid: [false, false, false, false], custom: [null, null, null, null], archived: false }
  ]
};

export function genId() {
  return "b-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

export function fmt(n) {
  const v = isNaN(n) ? 0 : n;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d) {
  if (!d) return "TBD";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function getParticipants(bill) {
  return Array.isArray(bill.participants) ? bill.participants : bill.personPaid.map(() => true);
}

export function isArchived(bill) {
  return !!bill.archived;
}

/* Normalizes a bill's per-person custom amounts to the current model:
   an array where each entry is either a fixed dollar amount that
   person pays, or null meaning "split the remainder evenly". */
export function getCustom(bill) {
  if (Array.isArray(bill.custom)) {
    return bill.custom.map((c) => (typeof c === "number" && !isNaN(c) ? c : null));
  }
  if (bill.splitMode === "custom" && Array.isArray(bill.shares)) {
    const participants = getParticipants(bill);
    return bill.shares.map((s, i) => (participants[i] && typeof s === "number" ? s : null));
  }
  return (bill.personPaid || []).map(() => null);
}

/* Given a bill, work out how much each person owes. People with a
   custom amount pay exactly that; everyone else included splits the
   remainder of the bill evenly among themselves. */
export function computeShares(bill) {
  const participants = getParticipants(bill);
  const custom = getCustom(bill);
  const n = participants.length;
  const amounts = new Array(n).fill(0);
  let customSum = 0;
  const splitIdx = [];
  for (let i = 0; i < n; i++) {
    if (!participants[i]) continue;
    const c = custom[i];
    if (typeof c === "number" && !isNaN(c)) {
      amounts[i] = c;
      customSum += c;
    } else {
      splitIdx.push(i);
    }
  }
  const remainder = (Number(bill.total) || 0) - customSum;
  const per = splitIdx.length ? remainder / splitIdx.length : 0;
  splitIdx.forEach((i) => (amounts[i] = per));
  const customCount = participants.filter((p, i) => p && typeof custom[i] === "number").length;
  const over = remainder < -0.005;
  const mismatch = splitIdx.length === 0 && Math.abs(remainder) > 0.005;
  return { amounts, per, splitCount: splitIdx.length, customCount, customSum, remainder, over, mismatch };
}

/* A bill is "settled" once the vendor has been paid and every
   included participant has been marked as reimbursed. */
export function isSettled(bill) {
  const participants = getParticipants(bill);
  if (!bill.vendorPaid) return false;
  return participants.every((inc, i) => !inc || bill.personPaid[i]);
}

export function computeTotals(bills) {
  const active = bills.filter((b) => !isArchived(b));
  const totalDue = active.filter((b) => !b.vendorPaid).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const dueToReceive = active.reduce((sum, b) => {
    const { amounts } = computeShares(b);
    const participants = getParticipants(b);
    let s = 0;
    participants.forEach((inc, i) => {
      if (inc && !b.personPaid[i]) s += amounts[i];
    });
    return sum + s;
  }, 0);
  return { totalDue, dueToReceive };
}

/* ---------- persistence layer ---------- */

let dbRef = null;
let fbSet = null;

/* Connects to Firebase (falling back to localStorage if it isn't
   configured or is unreachable) and keeps `onChange` informed of the
   live state plus connection metadata. Returns { push }. */
export function connectLedger(onChange) {
  const meta = { connected: false, usingFallback: false };

  function fallbackToLocal() {
    meta.connected = false;
    meta.usingFallback = true;
    let state;
    try {
      const raw = localStorage.getItem("bill-ledger-data");
      state = raw ? JSON.parse(raw) : DEFAULT_STATE;
    } catch (e) {
      state = DEFAULT_STATE;
    }
    onChange(state, meta);
  }

  (async () => {
    try {
      const looksUnconfigured = !firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("YOUR_") === 0;
      if (looksUnconfigured) throw new Error("Firebase not configured");

      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js");
      const { getDatabase, ref, onValue, set } = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js");

      const app = initializeApp(firebaseConfig);
      const db = getDatabase(app);
      dbRef = ref(db, DATA_PATH);
      fbSet = set;

      onValue(
        dbRef,
        (snapshot) => {
          const val = snapshot.val();
          meta.connected = true;
          meta.usingFallback = false;
          let state;
          if (val && Array.isArray(val.people) && Array.isArray(val.bills)) {
            state = val;
          } else {
            state = DEFAULT_STATE;
            fbSet(dbRef, state);
          }
          onChange(state, meta);
        },
        (err) => {
          console.error("Firebase read failed:", err);
          fallbackToLocal();
        }
      );
    } catch (e) {
      fallbackToLocal();
    }
  })();

  function push(newState) {
    if (dbRef && fbSet) {
      fbSet(dbRef, newState).catch((e) => console.error("Save failed:", e));
    } else {
      try {
        localStorage.setItem("bill-ledger-data", JSON.stringify(newState));
      } catch (e) {
        console.error("Local save failed:", e);
      }
      onChange(newState, meta);
    }
  }

  return { push };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
export function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* Small line-icon set (SF Symbols-ish), used by both pages. */
export const ICONS = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 13h4"/></svg>',
  restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m22 12-4 0-2 3h-8l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>'
};
