export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function button(label, className = "", attrs = "") {
  return `<button class="${className}" ${attrs}>${escapeHtml(label)}</button>`;
}

export function field(label, id, value = "", type = "text", attrs = "") {
  return `<label class="field"><span>${escapeHtml(label)}</span><input id="${id}" type="${type}" value="${escapeHtml(value)}" ${attrs}></label>`;
}

export function selectField(label, id, options, value = "") {
  const opts = options.map(o => {
    const v = typeof o === "object" ? o.value : o;
    const t = typeof o === "object" ? o.label : o;
    return `<option value="${escapeHtml(v)}" ${String(v) === String(value) ? "selected" : ""}>${escapeHtml(t)}</option>`;
  }).join("");
  return `<label class="field"><span>${escapeHtml(label)}</span><select id="${id}">${opts}</select></label>`;
}

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

export function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openModal(html, onClose) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal-card">${html}</div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", (ev) => {
    if (ev.target === wrap) {
      wrap.remove();
      if (onClose) onClose();
    }
  });
  return {
    root: wrap,
    close() {
      wrap.remove();
      if (onClose) onClose();
    }
  };
}
