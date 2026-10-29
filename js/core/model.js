// Datenmodell (neues Format, Version 1). Siehe docs/AUFBAU.md für die Feldbeschreibung.
// normalize*() füllt fehlende Felder auf – so bleiben alte Speicherstände ladbar,
// wenn später neue Felder hinzukommen.

import { uid } from './util.js';
import { initialStats, startLevel, calcAccuracy, calcEvasion } from './rules.js';

export const FORMAT_VERSION = 1;

const pokemonDefaults = () => ({
  kind: 'pokemon',
  version: FORMAT_VERSION,
  uuid: uid('pk'),
  trainerId: null,
  speciesId: null,     // Pokédex-ID (Formen > 10000)
  nickname: '',        // Alleinstellungsmerkmal neben der uuid
  formName: '',        // z.B. "Lava-Form" bei eigener Typ-Kombination
  types: [],           // überschreibbar → Custom-Form
  level: 1,
  exp: 0,
  stats: { hp: 0, speed: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0 },
  currentHp: 0,
  accuracy: null,      // null = beim Öffnen aus Regel berechnen
  evasion: null,
  // Daggerheart-Traits – reine Eingabefelder wie auf dem Trainerbogen
  traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
  traitMarks: {},
  unlocked: false,     // true = untypische Änderungen (Typen, Fähigkeiten, Attacken, Würfelklasse …) erlaubt
  levelUp: { primary: 'hp', secondary: 'attack', diceOverride: null },
  levelLog: [],
  moves: [null, null, null, null], // Attacken-Slugs (z.B. "ice-fang")
  abilities: [],       // Fähigkeits-Slugs; unbekannte Einträge = eigener Text
  item: '',
  gender: 'neutral',
  shiny: false,
  status: [],
  // Kampf-Momentaufnahme: mods = Stufen (× Level), initiative = zu Kampfbeginn erwürfelt
  battle: { initiative: null, mods: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, initiative: 0 } },
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function normalizePokemon(pk) {
  const d = pokemonDefaults();
  const out = { ...d, ...pk };
  out.stats = { ...d.stats, ...pk.stats };
  out.traits = { ...d.traits, ...pk.traits };
  out.levelUp = { ...d.levelUp, ...pk.levelUp };
  out.battle = { ...d.battle, ...pk.battle, mods: { ...d.battle.mods, ...pk.battle?.mods } };
  while (out.moves.length < 4) out.moves.push(null);
  delete out.movement;   // Bewegung entfällt (alte Speicherstände)
  delete out.friendship; // Freundschaft entfällt
  return out;
}

export function createPokemon(info, settings, { trainerId = null, nickname = '', level } = {}) {
  const lv = level || startLevel(info);
  const stats = initialStats(info, lv, settings);
  return normalizePokemon({
    trainerId,
    nickname,
    speciesId: info.id,
    types: [...info.types],
    level: lv,
    stats,
    currentHp: stats.hp,
    accuracy: calcAccuracy(info),
    evasion: calcEvasion(info),
    abilities: [...info.abilities],
    gender: info.genderRate === -1 ? 'neutral' : info.genderRate === 8 ? 'female' : 'male',
  });
}

/** Geschlechter, die die Art laut Spiel haben kann. */
export function allowedGenders(info) {
  if (info.genderRate === -1) return ['neutral'];
  if (info.genderRate === 0) return ['male'];
  if (info.genderRate === 8) return ['female'];
  return ['male', 'female'];
}

/** Attacken, die die Art laut Spiel lernen kann (Level, TM, Zucht, Tutor …). */
export const learnableMoves = (info) => new Set([...Object.keys(info.learn.level), ...info.learn.other]);

/** Custom-Form = Typen weichen von der Spezies ab. */
export const isCustomForm = (pk, info) =>
  info && pk.types.join('/') !== info.types.join('/');

// ---------------------------------------------------------------- Trainer

const trainerDefaults = () => ({
  kind: 'trainer',
  version: FORMAT_VERSION,
  id: uid('tr'),
  name: '',
  pronouns: '',
  class: '',
  boon: { name: '', effect: '' },
  heritage: { name: '', effect: '' }, // Heritage-Bonus
  portrait: '',          // Bild als data:-URL (verkleinert), reist mit Export/Backup mit
  level: 1,
  evasion: 10,
  capacity: 0,
  capacitySlots: Array(6).fill(false),
  traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
  traitMarks: {},
  thresholds: { major: 0, severe: 0 }, // Basiswerte; angezeigt wird + Level
  hp: { max: 6, marked: 0 },
  stress: { max: 6, marked: 0 },
  hope: 2,
  hopeFeature: '',
  experiences: [{ text: '', bonus: 2 }, { text: '', bonus: 2 }],
  classFeatures: [{ name: '', effect: '' }], // beliebig viele, je Name + Effekt
  connections: [],      // [{ name, info }]
  badges: Array(8).fill(false),
  team: [],            // [{ uuid, active }] – Reihenfolge & Aktiv/Inaktiv
  inventory: '',
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function normalizeTrainer(t) {
  const d = trainerDefaults();
  const out = {
    ...d,
    ...t,
    traits: { ...d.traits, ...t.traits },
    thresholds: { ...d.thresholds, ...t.thresholds },
    hp: { ...d.hp, ...t.hp },
    stress: { ...d.stress, ...t.stress },
    heritage: { ...d.heritage, ...t.heritage },
  };
  // Früher war der Boon nur ein Textfeld → wird zum Namen des Boons
  out.boon = typeof t.boon === 'string' ? { ...d.boon, name: t.boon } : { ...d.boon, ...t.boon };
  // Früher gab es nur ein Textfeld "classFeature" → wird zum ersten Class Feature
  if (!t.classFeatures && t.classFeature) out.classFeatures = [{ name: '', effect: t.classFeature }];
  delete out.classFeature;
  return out;
}

export const createTrainer = (name = '') => normalizeTrainer({ name });
