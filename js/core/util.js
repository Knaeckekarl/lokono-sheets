// Kleine Helfer ohne Abhängigkeiten.

/** HTML-Escaping für alles, was Nutzer eingeben (Spitznamen, Notizen ...). */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const today = () => new Date().toISOString().slice(0, 10);

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Wert über Pfad "a.b.0.c" lesen/schreiben (für data-f Bindings). */
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

export function downloadBlob(filename, blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadJson(filename, data) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

/** Dateiname ohne Sonderzeichen, z.B. "Pokemon_Haipirinha_Lv21_2026-10-13.json" */
export const safeName = (s) => String(s).replace(/[^\p{L}\p{N}_-]+/gu, '_');

export async function readJsonFiles(fileList) {
  const out = [];
  for (const file of fileList) {
    try {
      // BOM entfernen (alte Exporte haben eins)
      out.push({ name: file.name, data: JSON.parse((await file.text()).replace(/^﻿/, '')) });
    } catch (e) {
      out.push({ name: file.name, error: e.message });
    }
  }
  return out;
}

/** Fokus nach einem Re-Render wiederherstellen (Eingaben bleiben flüssig). */
export function rerenderKeepingFocus(root, render) {
  setTimeout(() => {
    const f = document.activeElement?.dataset?.f;
    render();
    if (f) root.querySelector(`[data-f="${CSS.escape(f)}"]`)?.focus();
  });
}
