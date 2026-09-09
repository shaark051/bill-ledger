import {
  connectLedger, getParticipants, getCustom, MAX_PARTICIPANTS, escapeHtml, escapeAttr, ICONS
} from "./data.js";

let state = null;
let connMeta = { connected: false, usingFallback: false };
let ledger = null;
let toastTimer = null;

let ui = { editingIdx: null, focusIdx: null, toast: null };

function pushState(newState) {
  state = newState;
  ledger.push(state);
  render();
}

function showToast(message) {
  ui.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast = null;
    render();
  }, 1600);
}

/* ---------- actions ---------- */

function addPerson() {
  if (state.people.length >= MAX_PARTICIPANTS) {
    showToast(`You've hit the ${MAX_PARTICIPANTS}-person limit.`);
    return;
  }
  const newIdx = state.people.length;
  ui.editingIdx = newIdx;
  ui.focusIdx = newIdx;
  pushState({
    people: [...state.people, "Person " + (newIdx + 1)],
    bills: state.bills.map((b) => ({
      ...b,
      participants: [...getParticipants(b), true],
      personPaid: [...b.personPaid, false],
      custom: [...getCustom(b), null]
    }))
  });
}

function removePersonAt(idx) {
  if (state.people.length <= 1) return;
  const name = state.people[idx];
  if (!confirm(`Remove ${name} from the household and every bill? This can't be undone.`)) return;
  pushState({
    people: state.people.filter((_, i) => i !== idx),
    bills: state.bills.map((b) => ({
      ...b,
      participants: getParticipants(b).filter((_, i) => i !== idx),
      personPaid: b.personPaid.filter((_, i) => i !== idx),
      custom: getCustom(b).filter((_, i) => i !== idx)
    }))
  });
  showToast(`${name} removed.`);
}

function renamePerson(idx, name) {
  const trimmed = (name || "").trim();
  if (!trimmed || trimmed === state.people[idx]) return;
  pushState({
    ...state,
    people: state.people.map((n, i) => (i === idx ? trimmed : n))
  });
  showToast("Saved.");
}

/* ---------- rendering ---------- */

function render() {
  const root = document.getElementById("app");
  if (!state) return;

  root.innerHTML = `
    <div class="topbar">
      <div class="topbar-inner container">
        <div class="topbar-titles">
          <h1>Participants</h1>
          <div class="sync-status">
            <span class="dot ${connMeta.usingFallback ? "dot--warn" : "dot--ok"}"></span>
            ${state.people.length} ${state.people.length === 1 ? "person" : "people"}
          </div>
        </div>
        <a class="nav-link" href="index.html">${ICONS.chevronLeft} Ledger</a>
      </div>
    </div>

    <div class="container">
      <div class="list-group" style="margin-top:20px;">
        ${state.people.map((p, i) => renderRow(p, i)).join("")}
      </div>

      <div class="add-card">
        <button class="add-toggle" data-action="add-person" ${state.people.length >= MAX_PARTICIPANTS ? "disabled" : ""}>
          ${ICONS.plus} Add a person
        </button>
      </div>

      <div class="page-footer">People here are available to add to any bill · up to ${MAX_PARTICIPANTS}</div>
    </div>

    ${ui.toast ? `<div class="toast">${escapeHtml(ui.toast)}</div>` : ""}
  `;

  attachHandlers();

  if (ui.focusIdx != null) {
    const input = document.getElementById("person-input-" + ui.focusIdx);
    if (input) {
      input.focus();
      input.select();
    }
    ui.focusIdx = null;
  }
}

function renderRow(p, i) {
  const nameCell =
    ui.editingIdx === i
      ? `<input class="participant-name-input" id="person-input-${i}" value="${escapeAttr(p)}" data-idx="${i}" />`
      : `<button class="participant-name-btn" data-action="start-rename" data-idx="${i}">${escapeHtml(p)}</button>`;
  return `
    <div class="person-list-row">
      ${nameCell}
      <button class="icon-btn danger" data-action="remove-person" data-idx="${i}" title="Remove ${escapeAttr(p)}" ${state.people.length <= 1 ? "disabled" : ""}>${ICONS.x}</button>
    </div>
  `;
}

/* ---------- event wiring ---------- */

function attachHandlers() {
  const root = document.getElementById("app");

  root.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-action");
      const idx = el.getAttribute("data-idx");
      if (action === "add-person") addPerson();
      else if (action === "remove-person") removePersonAt(Number(idx));
      else if (action === "start-rename") {
        ui.editingIdx = Number(idx);
        ui.focusIdx = Number(idx);
        render();
      }
    });
  });

  if (ui.editingIdx != null) {
    const input = document.getElementById("person-input-" + ui.editingIdx);
    if (input) {
      const idx = ui.editingIdx;
      const commit = () => {
        ui.editingIdx = null;
        renamePerson(idx, input.value);
        render();
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        }
        if (e.key === "Escape") {
          ui.editingIdx = null;
          render();
        }
      });
    }
  }
}

ledger = connectLedger((newState, meta) => {
  state = newState;
  connMeta = meta;
  render();
});
