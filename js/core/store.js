// Speicherung im Browser (localStorage) + Import/Export.
// Alle Daten bleiben lokal beim Nutzer; zum Teilen/Sichern gibt es JSON-Export.

import { DEFAULT_SETTINGS } from './rules.js';
import { normalizePokemon, normalizeTrainer, FORMAT_VERSION } from './model.js';
import { debounce } from './util.js';

const KEY = 'lokono-sheets.v1';

let db = { pokemon: {}, trainers: {}, settings: {} };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) db = { ...db, ...JSON.parse(raw) };
} catch (e) {
  console.warn('Speicher nicht lesbar – starte leer.', e);
}

const persist = debounce(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    alert('Speichern fehlgeschlagen (Speicher voll oder blockiert). Bitte exportieren!');
  }
}, 300);

// ---------------------------------------------------------------- Pokémon

export const listPokemon = () => Object.values(db.pokemon).map(normalizePokemon);
export const getPokemon = (uuid) => (db.pokemon[uuid] ? normalizePokemon(db.pokemon[uuid]) : null);

export function savePokemon(pk) {
  pk.updatedAt = new Date().toISOString();
  db.pokemon[pk.uuid] = pk;
  persist();
}

export function deletePokemon(uuid) {
  delete db.pokemon[uuid];
  for (const t of Object.values(db.trainers)) t.team = (t.team || []).filter((m) => m.uuid !== uuid);
  persist();
}

// ---------------------------------------------------------------- Trainer

export const listTrainers = () => Object.values(db.trainers).map(normalizeTrainer);
export const getTrainer = (id) => (db.trainers[id] ? normalizeTrainer(db.trainers[id]) : null);

export function saveTrainer(t) {
  t.updatedAt = new Date().toISOString();
  db.trainers[t.id] = t;
  persist();
}

export function deleteTrainer(id) {
  delete db.trainers[id];
  for (const pk of Object.values(db.pokemon)) if (pk.trainerId === id) pk.trainerId = null;
  persist();
}

/** Team eines Trainers: Reihenfolge aus trainer.team, neue Pokémon werden angehängt. */
export function teamOf(trainer) {
  const owned = listPokemon().filter((p) => p.trainerId === trainer.id);
  const order = new Map(trainer.team.map((m, i) => [m.uuid, i]));
  return owned
    .map((pk) => ({ pk, active: trainer.team.find((m) => m.uuid === pk.uuid)?.active ?? true }))
    .sort((a, b) => (order.get(a.pk.uuid) ?? 999) - (order.get(b.pk.uuid) ?? 999));
}

// ---------------------------------------------------------------- Einstellungen

export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...db.settings });
export function saveSettings(s) {
  db.settings = s;
  persist();
}

// ---------------------------------------------------------------- Import/Export

/** Einheitliches Exportformat für alles (einzelnes Pokémon, Trainer mit Team, Backup). */
export const bundle = ({ trainers = [], pokemon = [] }) => ({
  format: 'lokono-sheets',
  version: FORMAT_VERSION,
  exportedAt: new Date().toISOString(),
  trainers,
  pokemon,
});

export const exportAll = () => bundle({ trainers: listTrainers(), pokemon: listPokemon() });

/**
 * Übernimmt bereits migrierte Datensätze. Gleiche uuid/id = gleiches Pokémon/Trainer:
 * der neuere Stand (updatedAt) gewinnt. So kann man mehrere Sessions auf einmal importieren.
 */
export function mergeImport({ trainers = [], pokemon = [] }) {
  const result = { added: 0, updated: 0, skipped: 0 };
  const take = (table, key, item) => {
    const existing = table[item[key]];
    if (!existing) result.added++;
    else if ((item.updatedAt || '') > (existing.updatedAt || '')) result.updated++;
    else return result.skipped++;
    table[item[key]] = item;
  };
  trainers.forEach((t) => take(db.trainers, 'id', normalizeTrainer(t)));
  pokemon.forEach((p) => take(db.pokemon, 'uuid', normalizePokemon(p)));
  persist();
  return result;
}
