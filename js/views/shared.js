// Gemeinsame UI-Bausteine für alle Views.

import { esc, setPath } from '../core/util.js';
import { TYPES, SPRITE } from '../core/constants.js';
import { getPokedex, getSpecies, HOMEBREW_ID_START } from '../core/data.js';
import { createPokemon } from '../core/model.js';
import { startLevel } from '../core/rules.js';
import { savePokemon, getSettings } from '../core/store.js';

let dexMap = null;
/** Map: Pokédex-ID → { id, de, en, types, bst, sprite } (inkl. Homebrew) */
export async function pokedexMap() {
  if (!dexMap) {
    const list = await getPokedex();
    dexMap = new Map(list.map(([id, de, en, types, bst, sprite]) => [id, { id, de, en, types, bst, sprite }]));
  }
  return dexMap;
}
/** Nach Homebrew-Änderungen aufrufen. */
export const invalidateDex = () => { dexMap = null; };

// Platzhalter für Homebrew-Pokémon ohne Bild
const NO_SPRITE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="5" y="7.5" font-size="7" text-anchor="middle" fill="#999">?</text></svg>')}`;

const spriteUrl = (id, shiny) =>
  id >= HOMEBREW_ID_START ? dexMap?.get(id)?.sprite || NO_SPRITE : SPRITE(id, shiny);

export const typeBadge = (type) =>
  `<span class="type" style="--c:${TYPES[type]?.color || '#999'}">${esc(TYPES[type]?.de || type)}</span>`;

export const spriteImg = (id, { shiny = false, size = 64, cls = '' } = {}) =>
  `<img class="sprite ${cls}" src="${esc(spriteUrl(id, shiny))}" width="${size}" height="${size}" loading="lazy" alt="">`;

export const typeOptions = (selected, allowEmpty) =>
  (allowEmpty ? `<option value="">—</option>` : '') +
  Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${t.de}</option>`).join('');

/** <datalist> mit allen Pokémon – Eingabe "Kanivanha #318" */
export async function speciesDatalist(id) {
  const dex = await pokedexMap();
  const opts = [...dex.values()].map((p) => `<option value="${esc(p.de)} #${p.id}">`).join('');
  return `<datalist id="${id}">${opts}</datalist>`;
}

export async function parseSpeciesInput(value) {
  const m = /#(\d+)\s*$/.exec(value);
  const dex = await pokedexMap();
  if (m && dex.has(+m[1])) return +m[1];
  const v = value.trim().toLowerCase();
  return [...dex.values()].find((p) => p.de.toLowerCase() === v || p.en === v)?.id ?? null;
}

// ---------------------------------------------------------------- Level beim Erstellen

/** Level-Feld für Erstell-Formulare (leer = Startlevel der Art). */
export const levelInput = () =>
  '<input name="level" type="number" min="1" max="100" placeholder="Level" aria-label="Level" title="Level beim Erstellen – Standard: Startlevel der Art" class="new-lvl">';

/** Leeres Feld → null (Startlevel der Art), sonst auf 1–100 begrenzt. */
export const parseLevel = (value) =>
  value === '' || value == null || isNaN(+value) ? null : Math.min(100, Math.max(1, Math.round(+value)));

/**
 * Setzt das Level-Feld eines Formulars auf das Startlevel der Art, sobald im
 * Art-Feld (name="species") eine bekannte Art steht. Delegiert → übersteht Neuzeichnen.
 */
export function bindStartLevel(root) {
  root.addEventListener('input', async (e) => {
    const input = e.target;
    if (input.name !== 'species' || !input.form?.elements.level) return;
    const id = await parseSpeciesInput(input.value);
    if (id == null) return;
    const sp = (await pokedexMap()).get(id);
    if (sp) input.form.elements.level.value = startLevel(sp);
  });
}

export async function createAndSavePokemon(speciesId, opts) {
  const info = await getSpecies(speciesId);
  const pk = createPokemon(info, getSettings(), opts);
  savePokemon(pk);
  return pk;
}

/**
 * Bindet alle Elemente mit data-f="pfad.zum.feld" an ein Modell.
 *   data-t="num" | "bool" | "nullable"  → Typumwandlung
 *   data-rerender                        → nach Änderung neu zeichnen
 */
export function bindFields(root, getModel, { save, rerender }) {
  const handler = (e) => {
    const el = e.target.closest('[data-f]');
    if (!el || !root.contains(el)) return;
    const t = el.dataset.t;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (t === 'num') {
      if (v === '' || isNaN(+v)) return;
      v = +v;
    }
    if (t === 'nullable' && v === '') v = null;
    const model = getModel();
    setPath(model, el.dataset.f, v);
    save(model);
    if (e.type === 'change' && 'rerender' in el.dataset) rerender();
  };
  root.addEventListener('input', (e) => e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT' && handler(e));
  root.addEventListener('change', handler);
}

// ---------------------------------------------------------------- Daggerheart-Optik (für beide Bögen)

export const dhBanner = (title) => `<h3 class="dh-banner">${title}</h3>`;

/**
 * Kästchen-Leiste (HP, Stress, Hope …). Klick-Logik: siehe clickTrack().
 * @param {string} key  wird als data-track ausgegeben
 */
export const boxTrack = (key, max, marked, cls = 'box') =>
  Array.from({ length: max }, (_, i) =>
    `<button type="button" class="${cls} ${i < marked ? 'on' : ''}" data-track="${key}" data-i="${i}" aria-label="${i + 1}"></button>`).join('');

/** Klick auf Kästchen i: bis dorthin füllen; Klick auf das letzte gefüllte nimmt eins weg. */
export const clickTrack = (current, i) => (current === i + 1 ? i : i + 1);
