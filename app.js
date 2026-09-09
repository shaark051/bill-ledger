import {
  connectLedger, computeShares, computeTotals, getParticipants, getCustom,
  isArchived, isSettled, fmt, fmtDate, genId, escapeHtml, escapeAttr, ICONS
} from "./data.js";

let state = null;
let connMeta = { connected: false, usingFallback: false };
let ledger = null;

const SORT_KEY = "bill-ledger-sort-settled";
let ui = {
  draft: null,
  editingPersonIdx: null,
  formError: "",
  participantsOpen: false,
  sortSettled: localStorage.getItem(SORT_KEY) !== "0"
};

function pushState(newState) {
  state = newState;
  ledger.push(state);
  render();
}

/* ---------- draft (add / edit editor) helpers ---------- */

function newAddDraft() {
  return {
    billId: null,
    date: "",
    name: "",
    total: "",
    mode: "auto",
    include: state.people.map(() => true),
    amounts: state.people.map(() => "")
  };
}

function billToDraft(b) {
  const participants = getParticipants(b);
  const custom = getCustom(b);
  const hasCustom = custom.some((c, i) => participants[i] && typeof c === "number");
  return {
    billId: b.id,
    date: b.date || "",
    name: b.name || "",
    total: String(b.total),
    mode: hasCustom ? "custom" : "auto",
    include: participants.slice(),
    amounts: custom.map((c) => (typeof c === "number" ? String(c) : ""))
  };
}

function draftToShares(d) {
  const total = parseFloat(d.total);
  const t = isNaN(total) ? 0 : total;
  const n = d.include.length;
  const amounts = new Array(n).fill(0);
  let customSum = 0;
  const splitIdx = [];
  for (let i = 0; i < n; i++) {
    if (!d.include[i]) continue;
    if (d.mode === "custom") {
      const raw = d.amounts[i];
      const v = parseFloat(raw);
      if (raw !== "" && raw != null && !isNaN(v)) {
        amounts[i] = v;
        customSum += v;
        continue;
      }
    }
    splitIdx.push(i);
  }
  const remainder = t - customSum;
  const per = splitIdx.length ? remainder / splitIdx.length : 0;
  splitIdx.forEach((i) => (amounts[i] = per));
  const over = remainder < -0.005;
  const mismatch = splitIdx.length === 0 && Math.abs(remainder) > 0.005;
  return { amounts, per, splitCount: splitIdx.length, customSum, remainder, over, mismatch, total: t };
}

/* ---------- actions ---------- */

function addPerson() {
  if (state.people.length >= 8) return;
  pushState({
    people: [...state.people, "P" + (state.people.length + 1)],
    bills: state.bills.map((b) => ({
      ...b,
      participants: [...getParticipants(b), true],
      personPaid: [...b.personPaid, false],
      custom: [...getCustom(b), null]
    }))
  });
}

function removePerson() {
  if (state.people.length <= 1) return;
  pushState({
    people: state.people.slice(0, -1),
    bills: state.bills.map((b) => ({
      ...b,
      participants: getParticipants(b).slice(0, -1),
      personPaid: b.personPaid.slice(0, -1),
      custom: getCustom(b).slice(0, -1)
    }))
  });
}

function renamePerson(idx, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  pushState({
    ...state,
    people: state.people.map((n, i) => (i === idx ? trimmed : n))
  });
}

function cyclePersonState(billId, idx) {
  pushState({
    ...state,
    bills: state.bills.map((b) => {
      if (b.id !== billId) return b;
      const participants = getParticipants(b).slice();
      const personPaid = b.personPaid.slice();
      const custom = getCustom(b).slice();
      if (!participants[idx]) {
        participants[idx] = true;
        personPaid[idx] = false;
      } else if (!personPaid[idx]) {
        personPaid[idx] = true;
      } else {
        participants[idx] = false;
        personPaid[idx] = false;
        custom[idx] = null;
      }
      const next = { ...b, participants, personPaid, custom };
      delete next.splitMode;
      delete next.shares;
      return next;
    })
  });
}

function toggleVendorPaid(billId) {
  pushState({
    ...state,
    bills: state.bills.map((b) => (b.id === billId ? { ...b, vendorPaid: !b.vendorPaid } : b))
  });
}

function deleteBill(billId) {
  pushState({ ...state, bills: state.bills.filter((b) => b.id !== billId) });
}

function archiveBill(billId) {
  pushState({
    ...state,
    bills: state.bills.map((b) => (b.id === billId ? { ...b, archived: true, archivedAt: new Date().toISOString() } : b))
  });
}

function commitDraft() {
  const d = ui.draft;
  if (!d) return;
  const total = parseFloat(d.total);
  if (!d.name.trim() || isNaN(total) || total < 0) {
    ui.formError = "Enter a bill name and a valid amount.";
    render();
    return;
  }
  const res = draftToShares(d);
  if (!d.include.some(Boolean)) {
    ui.formError = "Pick at least one person for this bill.";
    render();
    return;
  }
  if (res.over) {
    ui.formError = "Custom amounts add up to more than the bill total.";
    render();
    return;
  }
  if (res.mismatch) {
    ui.formError = "Custom amounts must add up to the total, or leave someone to split the rest.";
    render();
    return;
  }
  ui.formError = "";

  const custom = d.include.map((inc, i) => {
    if (!inc || d.mode !== "custom") return null;
    const raw = d.amounts[i];
    const v = parseFloat(raw);
    return raw !== "" && raw != null && !isNaN(v) ? v : null;
  });
  const participants = d.include.slice();

  if (d.billId == null) {
    pushState({
      ...state,
      bills: [
        ...state.bills,
        {
          id: genId(),
          date: d.date,
          name: d.name.trim(),
          total,
          vendorPaid: false,
          participants,
          personPaid: state.people.map(() => false),
          custom,
          archived: false
        }
      ]
    });
  } else {
    pushState({
      ...state,
      bills: state.bills.map((b) => {
        if (b.id !== d.billId) return b;
        const prevPaid = b.personPaid || [];
        const personPaid = participants.map((inc, i) => (inc ? !!prevPaid[i] : false));
        const next = { ...b, date: d.date, name: d.name.trim() || b.name, total, participants, personPaid, custom };
        delete next.splitMode;
        delete next.shares;
        return next;
      })
    });
  }
  ui.draft = null;
}

/* ---------- rendering ---------- */

function render() {
  const root = document.getElementById("app");
  if (!state) return;
  const { totalDue, dueToReceive } = computeTotals(state.bills);

  const activeBills = state.bills
    .map((b, originalIdx) => ({ b, originalIdx }))
    .filter((row) => !isArchived(row.b));

  if (ui.sortSettled) {
    activeBills.sort((a, b) => (isSettled(a.b) === isSettled(b.b) ? 0 : isSettled(a.b) ? 1 : -1));
  }

  root.innerHTML = `
    <div class="topbar">
      <div class="topbar-inner container">
        <div class="topbar-titles">
          <h1>Bill Ledger</h1>
          <div class="sync-status">
            <span class="dot ${connMeta.usingFallback ? "dot--warn" : "dot--ok"}"></span>
            ${connMeta.usingFallback ? "Saving to this device only" : "Synced live across your household"}
          </div>
        </div>
        <a class="nav-link" href="archive.html">Archive ${ICONS.chevronRight}</a>
      </div>
    </div>

    <div class="container">
      <div class="summary-tiles">
        <div class="tile">
          <div class="tile-label">Total Due</div>
          <div class="tile-value ${totalDue > 0 ? "due" : "zero"}">${fmt(totalDue)}</div>
        </div>
        <div class="tile">
          <div class="tile-label">Due to Receive</div>
          <div class="tile-value ${dueToReceive > 0 ? "receive" : "zero"}">${fmt(dueToReceive)}</div>
        </div>
      </div>

      <div class="toolbar">
        <span class="toolbar-count">${activeBills.length} bill${activeBills.length === 1 ? "" : "s"}</span>
        <div class="toolbar-toggle">
          <span class="toolbar-toggle-label">Paid bills to bottom</span>
          <button class="switch" data-action="toggle-sort" aria-pressed="${ui.sortSettled}"><span class="switch-knob"></span></button>
        </div>
      </div>

      ${activeBills.length === 0 ? renderEmptyState() : `<div class="list-group">${activeBills.map((row, i) => renderBillRow(row.b, i)).join("")}</div>`}

      <div class="add-card">
        ${ui.draft && ui.draft.billId == null ? renderAddForm() : `<button class="add-toggle" data-action="show-add-form">${ICONS.plus} Add a bill</button>`}
      </div>

      ${renderParticipants()}

      <div class="page-footer">Bill Ledger · v3.0</div>
    </div>
  `;

  attachHandlers();
}

function renderEmptyState() {
  return `
    <div class="list-group">
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.inbox}</div>
        No active bills — add your first one below.
      </div>
    </div>
  `;
}

function renderParticipants() {
  const open = ui.participantsOpen;
  return `
    <div class="participants-card ${open ? "open" : ""}">
      <button class="participants-header" data-action="toggle-participants">
        <span class="participants-title">${ICONS.people} Participants</span>
        <span class="participants-caret">${ICONS.chevronRight}</span>
      </button>
      ${open ? `
        <div class="participants-body">
          ${state.people.map((p, i) => renderParticipantRow(p, i)).join("")}
          <div class="participants-footer">
            <button class="icon-round-btn" data-action="add-person" title="Add person">${ICONS.plus}</button>
            ${state.people.length > 1 ? `<button class="icon-round-btn danger" data-action="remove-person" title="Remove last person">${ICONS.x}</button>` : ""}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderParticipantRow(p, i) {
  if (ui.editingPersonIdx === i) {
    return `<div class="participant-row"><input class="participant-name-input" id="person-input-${i}" value="${escapeAttr(p)}" data-idx="${i}" /></div>`;
  }
  return `<div class="participant-row"><button class="participant-name-btn" data-action="start-rename-person" data-idx="${i}">${escapeHtml(p)}</button></div>`;
}

function renderBillRow(b, idx) {
  if (ui.draft && ui.draft.billId === b.id) {
    return renderEditRow(b, idx);
  }
  const { amounts, per, splitCount, customCount, over, mismatch } = computeShares(b);
  const participants = getParticipants(b);
  const custom = getCustom(b);
  const participantCount = participants.filter(Boolean).length;
  const settled = isSettled(b);

  let shareText;
  if (splitCount > 0) {
    shareText = `${fmt(per)} / split`;
    if (customCount > 0) shareText += ` · ${customCount} custom`;
  } else {
    shareText = "all custom";
  }
  if (participantCount !== state.people.length) {
    shareText += ` · ${participantCount} of ${state.people.length}`;
  }
  const warn = over || mismatch;
  if (over) shareText = "custom amounts exceed total";
  else if (mismatch) shareText = "custom amounts don't match total";

  return `
    <div class="bill-row ${settled ? "settled" : ""}">
      <div class="bill-row-top">
        <div class="bill-main">
          <div class="bill-title-line">
            <span class="bill-name">${escapeHtml(b.name)}</span>
            <span class="bill-date">${fmtDate(b.date)}${settled ? " · Settled" : ""}</span>
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
                const title = !included
                  ? `${p} is not part of this bill — click to include`
                  : `${p} owes ${fmt(amounts[i])}${isCustom ? " (set amount)" : " (even split)"} and has ${paid ? "paid" : "not paid"} — click to ${paid ? "leave out of this bill" : "mark paid"}`;
                return `
              <button class="chip ${cls}" data-action="toggle-person" data-bill-id="${b.id}" data-person-idx="${i}" title="${escapeAttr(title)}">
                ${label}${escapeHtml(p)}${amtText}
              </button>`;
              })
              .join("")}
          </div>
        </div>
        <div class="bill-amount-col">
          <div class="bill-amount">${fmt(b.total)}</div>
          <div class="bill-share${warn ? " warn" : ""}">${shareText}</div>
          <button class="status-pill ${b.vendorPaid ? "paid" : "unpaid"}" data-action="toggle-vendor" data-bill-id="${b.id}">${b.vendorPaid ? "PAID" : "UNPAID"}</button>
          <div class="bill-actions">
            <button class="icon-btn accent" data-action="start-edit" data-bill-id="${b.id}" title="Edit bill & split">${ICONS.pencil}</button>
            <button class="icon-btn" data-action="archive-bill" data-bill-id="${b.id}" title="Archive bill">${ICONS.archive}</button>
            <button class="icon-btn danger" data-action="delete-bill" data-bill-id="${b.id}" title="Delete bill">${ICONS.trash}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEditRow(b, idx) {
  const d = ui.draft;
  return `
    <div class="bill-row">
      <form id="draft-form">
        <div class="form-row">
          <input type="date" class="field" id="draft-date" value="${escapeAttr(d.date)}" />
          <input type="text" class="field" id="draft-name" value="${escapeAttr(d.name)}" style="flex:1; min-width:120px;" placeholder="Bill name" />
          <input type="number" step="0.01" class="field" id="draft-total" value="${escapeAttr(d.total)}" style="width:90px;" placeholder="0.00" />
        </div>
        ${renderSplitEditor(d)}
        ${ui.formError ? `<div class="form-error">${escapeHtml(ui.formError)}</div>` : ""}
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save</button>
          <button type="button" class="btn-ghost" data-action="cancel-draft">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function renderAddForm() {
  const d = ui.draft;
  return `
    <div class="form-card">
      <form id="draft-form">
        <div class="form-row">
          <input type="date" class="field" id="draft-date" value="${escapeAttr(d.date)}" />
          <input type="text" class="field" id="draft-name" placeholder="Bill name" style="flex:1; min-width:140px;" value="${escapeAttr(d.name)}" />
          <input type="number" step="0.01" min="0" class="field" id="draft-total" placeholder="0.00" style="width:100px;" value="${escapeAttr(d.total)}" />
        </div>
        ${renderSplitEditor(d)}
        ${ui.formError ? `<div class="form-error">${escapeHtml(ui.formError)}</div>` : ""}
        <div class="form-actions">
          <button type="submit" class="btn-primary">Add bill</button>
          <button type="button" class="btn-secondary" data-action="cancel-draft">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function renderSplitEditor(d) {
  const res = draftToShares(d);
  return `
    <div class="split-editor">
      <div class="segmented">
        <button type="button" class="segmented-btn ${d.mode === "auto" ? "active" : ""}" data-action="draft-mode" data-mode="auto">Even split</button>
        <button type="button" class="segmented-btn ${d.mode === "custom" ? "active" : ""}" data-action="draft-mode" data-mode="custom">Custom amounts</button>
      </div>
      <div class="editor-hint">
        ${d.mode === "auto"
          ? "Everyone ticked splits the bill evenly."
          : "Type an amount for anyone paying a set share. Leave it blank to split whatever's left evenly."}
      </div>
      ${state.people
        .map((p, i) => {
          const inc = d.include[i];
          const amtInput =
            d.mode === "custom"
              ? `<input type="number" step="0.01" min="0" class="field amt-input" id="amt-${i}" data-idx="${i}" value="${escapeAttr(d.amounts[i] || "")}" placeholder="split" ${inc ? "" : "disabled"} />`
              : "";
          return `
        <div class="person-line">
          <label><input type="checkbox" data-action="draft-include" data-idx="${i}" ${inc ? "checked" : ""} /> <span class="person-name">${escapeHtml(p)}</span></label>
          ${amtInput}
          <span class="person-owe" id="owe-${i}">${inc ? fmt(res.amounts[i]) : "—"}</span>
        </div>`;
        })
        .join("")}
      <div class="preview-text${res.over || res.mismatch ? " warn" : ""}" id="editor-preview">${escapeHtml(editorPreviewText(res))}</div>
    </div>
  `;
}

function editorPreviewText(res) {
  if (res.over) return "Custom amounts exceed the bill total by " + fmt(-res.remainder) + ".";
  if (res.mismatch)
    return "Custom amounts total " + fmt(res.customSum) + " of " + fmt(res.total) + " — assign the rest or let someone split it.";
  if (res.splitCount > 0) {
    return res.customSum > 0
      ? "Even split: " + fmt(res.per) + " each for " + res.splitCount + " · custom total " + fmt(res.customSum)
      : "Even split: " + fmt(res.per) + " each for " + res.splitCount + ".";
  }
  return "All set by hand — totals " + fmt(res.customSum) + ".";
}

/* Live-update the owed amounts and preview text without a full
   re-render, so text inputs keep focus while typing. */
function refreshEditor() {
  const d = ui.draft;
  if (!d) return;
  const res = draftToShares(d);
  d.include.forEach((inc, i) => {
    const span = document.getElementById("owe-" + i);
    if (span) span.textContent = inc ? fmt(res.amounts[i]) : "—";
  });
  const prev = document.getElementById("editor-preview");
  if (prev) {
    prev.className = "preview-text" + (res.over || res.mismatch ? " warn" : "");
    prev.textContent = editorPreviewText(res);
  }
}

/* ---------- event wiring ---------- */

function attachHandlers() {
  const root = document.getElementById("app");

  root.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const action = el.getAttribute("data-action");
      const billId = el.getAttribute("data-bill-id");
      const idx = el.getAttribute("data-idx");
      const personIdx = el.getAttribute("data-person-idx");

      if (action === "add-person") addPerson();
      else if (action === "remove-person") removePerson();
      else if (action === "toggle-participants") {
        ui.participantsOpen = !ui.participantsOpen;
        render();
      } else if (action === "toggle-sort") {
        ui.sortSettled = !ui.sortSettled;
        localStorage.setItem(SORT_KEY, ui.sortSettled ? "1" : "0");
        render();
      } else if (action === "start-rename-person") {
        ui.editingPersonIdx = Number(idx);
        render();
        const input = document.getElementById("person-input-" + idx);
        if (input) {
          input.focus();
          input.select();
        }
      } else if (action === "toggle-person") cyclePersonState(billId, Number(personIdx));
      else if (action === "toggle-vendor") toggleVendorPaid(billId);
      else if (action === "archive-bill") archiveBill(billId);
      else if (action === "delete-bill") {
        if (confirm("Delete this bill? This can't be undone. Use Archive if you just want it out of sight.")) deleteBill(billId);
      } else if (action === "start-edit") {
        const bill = state.bills.find((b) => b.id === billId);
        if (bill) {
          ui.draft = billToDraft(bill);
          ui.formError = "";
          render();
        }
      } else if (action === "show-add-form") {
        ui.draft = newAddDraft();
        ui.formError = "";
        render();
      } else if (action === "cancel-draft") {
        ui.draft = null;
        ui.formError = "";
        render();
      } else if (action === "draft-mode") {
        if (ui.draft) {
          ui.draft.mode = el.getAttribute("data-mode");
          render();
        }
      } else if (action === "draft-include") {
        if (ui.draft) {
          ui.draft.include[Number(idx)] = el.checked;
          render();
        }
      }
    });
  });

  state.people.forEach((p, i) => {
    if (ui.editingPersonIdx === i) {
      const input = document.getElementById("person-input-" + i);
      if (!input) return;
      const commit = () => {
        renamePerson(i, input.value);
        ui.editingPersonIdx = null;
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          ui.editingPersonIdx = null;
          render();
        }
      });
    }
  });

  const draftForm = document.getElementById("draft-form");
  if (draftForm && ui.draft) {
    const d = ui.draft;
    const dDate = document.getElementById("draft-date");
    if (dDate) dDate.addEventListener("input", (e) => (d.date = e.target.value));
    const dName = document.getElementById("draft-name");
    if (dName) dName.addEventListener("input", (e) => (d.name = e.target.value));
    const dTotal = document.getElementById("draft-total");
    if (dTotal)
      dTotal.addEventListener("input", (e) => {
        d.total = e.target.value;
        refreshEditor();
      });
    d.include.forEach((_, i) => {
      const amt = document.getElementById("amt-" + i);
      if (amt)
        amt.addEventListener("input", (e) => {
          d.amounts[i] = e.target.value;
          refreshEditor();
        });
    });
    draftForm.addEventListener("submit", (e) => {
      e.preventDefault();
      commitDraft();
    });
  }
}

ledger = connectLedger((newState, meta) => {
  state = newState;
  connMeta = meta;
  render();
});
