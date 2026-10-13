// Zugriff auf die Spieldaten:
//   data/*.json          → Original-Spieldaten (erzeugt von tools/build_data.py, nicht von Hand ändern)
//   homebrew/homebrew.json → eigene Pokémon/Attacken/Fähigkeiten, gilt für ALLE Nutzer der Seite
//   lokaler Entwurf      → Homebrew-Änderungen aus dem Editor, die (noch) nur bei dir gelten
// Jede Datei wird höchstens einmal geladen und dann im Speicher gehalten.

const DRAFT_KEY = 'lokono-homebrew-draft';
export const HOMEBREW_ID_START = 20000; // eigene Pokémon bekommen IDs ab hier
const cache = new Map();
// Pfade relativ zum Projektordner – funktioniert auch unter https://nutzer.github.io/repo/
const ROOT = new URL('../../', import.meta.url);

function load(path, init) {
  if (!cache.has(path)) {
    cache.set(path, fetch(new URL(path, ROOT), init).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    }).catch((e) => {
      cache.delete(path); // bei Fehler später erneut versuchen
      throw e;
    }));
  }
  return cache.get(path);
}

// ---------------------------------------------------------------- Homebrew

export const emptyHomebrew = () => ({ pokemon: [], moves: {}, abilities: {} });

/** Veröffentlichter Stand aus dem Repo (immer frisch prüfen, die Datei ist klein). */
export const getPublishedHomebrew = () =>
  load('homebrew/homebrew.json', { cache: 'no-cache' }).catch(() => emptyHomebrew());

export function getDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}
export function setDraft(hb) {
  try {
    if (hb) localStorage.setItem(DRAFT_KEY, JSON.stringify(hb));
    else localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    alert('Entwurf konnte nicht gespeichert werden.');
  }
}

/** Aktiver Homebrew-Stand: lokaler Entwurf, falls vorhanden, sonst der veröffentlichte. */
export async function getHomebrew() {
  return { ...emptyHomebrew(), ...(getDraft() || (await getPublishedHomebrew())) };
}

const bstOf = (base) => Object.values(base || {}).reduce((s, v) => s + (+v || 0), 0);

// ---------------------------------------------------------------- Öffentliche API

/** Index aller Pokémon: [[id, deName, enName, [typen], bst, sprite?], ...] */
export async function getPokedex() {
  const [list, hb] = await Promise.all([load('data/pokedex.json'), getHomebrew()]);
  return [...list, ...hb.pokemon.map((p) => [p.id, p.de, p.de, p.types, bstOf(p.base), p.sprite || ''])];
}

/** Details einer Spezies/Form (Basiswerte, Entwicklung, Lernset, Fähigkeiten) */
export async function getSpecies(id) {
  if (id >= HOMEBREW_ID_START) {
    const p = (await getHomebrew()).pokemon.find((x) => x.id === id);
    if (!p) throw new Error(`Homebrew-Pokémon #${id} existiert nicht (mehr).`);
    return {
      speciesId: id, en: p.de, height: 0, weight: 0, legendary: false, mythical: false, genderRate: 4,
      abilities: [], hiddenAbility: null, learn: { level: {}, other: [] },
      ...p,
      evo: { stage: 0, remaining: 0, firstLevel: 0, secondLevel: 0, pre: null, ...p.evo },
      bst: bstOf(p.base),
      homebrew: true,
    };
  }
  return load(`data/pokemon/${id}.json`);
}

/** Alle Attacken: { slug: { n, t, c, p, a, pp, pr, d, hb? } } */
export async function getMoves() {
  const [moves, hb] = await Promise.all([load('data/moves.json'), getHomebrew()]);
  return { ...moves, ...tag(hb.moves) };
}

/** Alle Fähigkeiten: { slug: { n, d, hb? } } */
export async function getAbilities() {
  const [abilities, hb] = await Promise.all([load('data/abilities.json'), getHomebrew()]);
  return { ...abilities, ...tag(hb.abilities) };
}

const tag = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, { ...v, hb: true }]));
