import {
  connectLedger, computeShares, getParticipants, getCustom,
  isArchived, fmt, fmtDate, escapeHtml, ICONS
} from "./data.js";

let state = null;
let connMeta = { connected: false, usingFallback: false };
let ledger = null;

function pushState(newState) {
  state = newState;
  ledger.push(state);
  render();
}

function restoreBill(billId) {
  pushState({
    ...state,
    bills: state.bills.map((b) => {
      if (b.id !== billId) return b;
      const next = { ...b, archived: false };
      delete next.archivedAt;
      return next;
    })
  });
}

function deleteForever(billId) {
  pushState({ ...state, bills: state.bills.filter((b) => b.id !== billId) });
}

function render() {
  const root = document.getElementById("app");
  if (!state) return;
  const archivedBills = state.bills.filter(isArchived);

  root.innerHTML = `
    <div class="topbar">
      <div class="topbar-inner container">
        <div class="topbar-titles">
          <h1>Archive</h1>
          <div class="sync-status">
            <span class="dot ${connMeta.usingFallback ? "dot--warn" : "dot--ok"}"></span>
            ${archivedBills.length} archived bill${archivedBills.length === 1 ? "" : "s"}
          </div>
        </div>
        <a class="nav-link" href="index.html">${ICONS.chevronLeft} Ledger</a>
      </div>
    </div>

    <div class="container">
      ${archivedBills.length === 0 ? renderEmptyState() : `<div class="list-group" style="margin-top:20px;">${archivedBills.map((b) => renderArchivedRow(b)).join("")}</div>`}
      <div class="page-footer">Archived bills don't count toward your totals on the ledger.</div>
    </div>
  `;

  attachHandlers();
}

function renderEmptyState() {
  return `
    <div class="list-group" style="margin-top:20px;">
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.archive}</div>
        No archived bills. Bills you archive from the ledger will show up here.
      </div>
    </div>
  `;
}

function renderArchivedRow(b) {
  const { amounts, per, splitCount, over, mismatch } = computeShares(b);
  const participants = getParticipants(b);
  const custom = getCustom(b);
  const warn = over || mismatch;
  let shareText = splitCount > 0 ? `${fmt(per)} / split` : "all custom";
  if (over) shareText = "custom amounts exceed total";
  else if (mismatch) shareText = "custom amounts don't match total";

  const archivedDate = b.archivedAt ? new Date(b.archivedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : null;

  return `
    <div class="bill-row">
      <div class="bill-row-top">
        <div class="bill-main">
          <div class="bill-title-line">
            <span class="bill-name">${escapeHtml(b.name)}</span>
            <span class="bill-date">${fmtDate(b.date)}</span>
          </div>
          <div class="chips">
            ${state.people
              .map((p, i) => {
                const included = participants[i];
                const paid = b.personPaid[i];
                const isCustom = included && typeof custom[i] === "number";
                const cls = !included ? "excluded" : paid ? "paid" : "unpaid";
                const label = !included ? "− " : paid ? "✓ " : "";
                const amtText = included ? `<span> · ${fmt(amounts[i])}${isCustom ? '<span class="chip-star">*</span>' : ""}</span>` : "";
                return `<span class="chip ${cls}">${label}${escapeHtml(p)}${amtText}</span>`;
              })
              .join("")}
          </div>
          ${archivedDate ? `<div class="archived-badge">Archived ${archivedDate}</div>` : ""}
          <div class="archive-row-actions">
            <button class="text-action blue" data-action="restore" data-bill-id="${b.id}">${ICONS.restore} Restore</button>
            <button class="text-action red" data-action="delete-forever" data-bill-id="${b.id}">${ICONS.trash} Delete permanently</button>
          </div>
        </div>
        <div class="bill-amount-col">
          <div class="bill-amount">${fmt(b.total)}</div>
          <div class="bill-share${warn ? " warn" : ""}">${shareText}</div>
        </div>
      </div>
    </div>
  `;
}

function attachHandlers() {
  const root = document.getElementById("app");
  root.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-action");
      const billId = el.getAttribute("data-bill-id");
      if (action === "restore") restoreBill(billId);
      else if (action === "delete-forever") {
        if (confirm("Permanently delete this bill? This can't be undone.")) deleteForever(billId);
      }
    });
  });
}

ledger = connectLedger((newState, meta) => {
  state = newState;
  connMeta = meta;
  render();
});
