// Alle Spielregeln an EINER Stelle. Wer Regeln ändern will, ändert nur diese Datei
// (bzw. die Einstellungen in der App, die DEFAULT_SETTINGS überschreiben).

import { roll } from './dice.js';
import { STATS } from './constants.js';

export const DEFAULT_SETTINGS = {
  // Würfelklassen in aufsteigender Reihenfolge
  diceLadder: ['1W4', '1W6', '1W8', '1W10', '1W12', '2W6', '2W8', '2W10', '2W12', '2W100'],
  // BST bis einschließlich "max" → Würfelklasse. max: null = alles darüber.
  bstThresholds: [
    { max: 299, dice: '1W4' },
    { max: 400, dice: '1W6' },
    { max: 450, dice: '1W8' },
    { max: 500, dice: '1W10' },
    { max: 550, dice: '1W12' },
    { max: null, dice: '2W6' },
  ],
  legendaryDice: '2W100',
  maxNonLegendaryDice: '2W12',
  evolutionModifiers: true, // Entwicklungs-Regeln der alten Seite anwenden
  rerollOnes: true,         // gewürfelte 1en werden neu gewürfelt (pro Würfel, bis keine 1)
  hpMultiplier: 3,          // KP-Erhöhung beim Levelup ×3
  speedMultiplier: 1,       // Initiative hat KEINEN Multiplikator
  friendshipMax: 10,        // Anzahl Freundschafts-Kästchen
};

// ---------------------------------------------------------------- Würfelklasse

/**
 * Ermittelt die Würfelklasse aus den Spezies-Daten (Port der alten DiceCalculator-Logik).
 * @returns {{dice: string, steps: string[]}} steps = Begründung für Tooltip/Anzeige
 */
export function diceClassFor(info, settings = DEFAULT_SETTINGS) {
  const ladder = settings.diceLadder;
  const steps = [];
  if (info.legendary || info.mythical) {
    return { dice: settings.legendaryDice, steps: ['Legendär/Mysteriös'] };
  }
  const t = settings.bstThresholds.find((x) => x.max == null || info.bst <= x.max);
  let i = ladder.indexOf(t.dice);
  steps.push(`BST ${info.bst} → ${t.dice}`);

  const evo = info.evo || {};
  const bump = (reason) => {
    i = Math.min(i + 1, ladder.length - 1);
    steps.push(`${reason} → +1`);
  };

  if (settings.evolutionModifiers) {
    const target = ladder.indexOf('1W10');
    if (!evo.stage && !evo.remaining && i !== target) {
      i += i < target ? 1 : -1;
      steps.push('Entwickelt sich nicht → Richtung 1W10');
    }
    if (evo.stage >= 2) bump('Zweite Entwicklungsstufe');
    if (evo.stage > 0 && evo.firstLevel >= 32) bump(`Erste Entwicklung ab Lv ${evo.firstLevel}`);
    if (evo.stage > 0 && evo.firstLevel >= 42) bump(`Erste Entwicklung ab Lv ${evo.firstLevel}`);
    if (evo.stage > 0 && (evo.firstLevel >= 50 || evo.secondLevel >= 50)) bump('Entwicklung ab Lv 50');
    if (evo.stage > 0 && evo.pre) {
      const pre = diceClassFor({ ...evo.pre, evo: { ...evo.pre, pre: null } }, settings);
      steps.push(`Vorstufe hat ${pre.dice}`);
      if (i <= ladder.indexOf(pre.dice)) bump('Nicht besser als Vorstufe');
    }
  }

  const cap = ladder.indexOf(settings.maxNonLegendaryDice);
  if (i > cap) {
    i = cap;
    steps.push(`Begrenzt auf ${settings.maxNonLegendaryDice}`);
  }
  return { dice: ladder[i], steps };
}

/** Würfelklasse, die tatsächlich benutzt wird (manuelle Überschreibung hat Vorrang). */
export function effectiveDice(pk, info, settings) {
  return pk.levelUp.diceOverride || diceClassFor(info, settings).dice;
}

// ---------------------------------------------------------------- Startwerte

export const startLevel = (info) => Math.max(1, Math.floor(info.bst * 0.1));
export const expForNextLevel = (level) => level * level;

/** Wie viele Levelups die aktuelle EXP hergibt (bis max. Level 100). */
export function possibleLevelUps(pk) {
  let { level, exp } = pk;
  let n = 0;
  while (level < 100 && exp >= expForNextLevel(level)) {
    exp -= expForNextLevel(level);
    level++;
    n++;
  }
  return n;
}

const gameStat = (base, level) => Math.floor((2 * base * level) / 100 + 5);
const gameHp = (base, level) => Math.floor((2 * base * level) / 100 + level + 10);

export function initialStats(info, level, settings = DEFAULT_SETTINGS) {
  const b = info.base;
  return {
    hp: gameHp(b.hp, level) * settings.hpMultiplier,
    speed: gameStat(b.speed, level),
    attack: gameStat(b.attack, level),
    defense: gameStat(b.defense, level),
    spAttack: gameStat(b.spAttack, level),
    spDefense: gameStat(b.spDefense, level),
  };
}

/**
 * Accuracy & Evasion ersetzen GENA & PA.
 * TODO(Regel): Neue Formel hier eintragen. Bis dahin: Startwert 5, manuell änderbar.
 */
export function calcAccuracy(info) {
  return 5;
}
export function calcEvasion(info) {
  return 5;
}

// ---------------------------------------------------------------- Kampfwerte (Momentaufnahme)

/** Werte, die im Kampf per ±Level verändert werden. "initiative" = im Kampf erwürfelte Initiative. */
export const BATTLE_STATS = ['attack', 'defense', 'spAttack', 'spDefense', 'initiative'];

/**
 * Aktueller Kampfwert = dauerhafter Wert + Stufen × Level. Der dauerhafte Wert bleibt unverändert.
 * Kampf-Initiative startet erst, wenn zu Kampfbeginn ein Wurf eingetragen wurde (sonst null).
 */
export function battleValue(pk, stat) {
  const shift = (pk.battle.mods[stat] || 0) * pk.level;
  if (stat === 'initiative') return pk.battle.initiative == null ? null : pk.battle.initiative + shift;
  return pk.stats[stat] + shift;
}

/** Heilen wie im Pokémon-Center: KP voll, Kampfänderungen und Statusprobleme weg. */
export function heal(pk) {
  pk.currentHp = pk.stats.hp;
  pk.battle = { initiative: null, mods: Object.fromEntries(BATTLE_STATS.map((s) => [s, 0])) };
  pk.status = [];
}

// ---------------------------------------------------------------- Levelup

const multiplierFor = (stat, settings) =>
  stat === 'hp' ? settings.hpMultiplier : stat === 'speed' ? settings.speedMultiplier : 1;

function applyRoll(pk, stat, kind, dice, settings) {
  const r = roll(dice, { rerollOnes: settings.rerollOnes });
  const mult = multiplierFor(stat, settings);
  const before = pk.stats[stat];
  pk.stats[stat] = before + r.total * mult;
  return { kind, stat, roll: r, mult, gain: r.total * mult, before, after: pk.stats[stat] };
}

/**
 * Ein Levelup:
 *  1. Ein zufälliger Statuswert wird mit der Würfelklasse erhöht.
 *  2. Die Primärwahl wird erhöht – oder die Sekundärwahl, falls der Zufall
 *     bereits die Primärwahl getroffen hat.
 * Gibt einen Log-Eintrag zurück, der ALLE Würfe (inkl. neu gewürfelter 1en) enthält.
 * @param {boolean} free  true = Level ohne EXP-Kosten (z.B. vom Spielleiter vergeben)
 */
export function levelUp(pk, info, settings, { free = false } = {}) {
  const need = expForNextLevel(pk.level);
  if (!free && pk.exp < need) return null;

  const snapshot = { level: pk.level, exp: pk.exp, stats: { ...pk.stats }, currentHp: pk.currentHp };
  const dice = effectiveDice(pk, info, settings);

  if (!free) pk.exp -= need;
  pk.level += 1;

  const randomStat = STATS[Math.floor(Math.random() * STATS.length)];
  const { primary, secondary } = pk.levelUp;
  const usePrimary = randomStat !== primary;

  const rolls = [
    applyRoll(pk, randomStat, 'Zufall', dice, settings),
    applyRoll(pk, usePrimary ? primary : secondary, usePrimary ? 'Primärwahl' : 'Sekundärwahl', dice, settings),
  ];
  pk.currentHp = pk.stats.hp; // Levelup heilt vollständig (wie bisher)

  const entry = {
    at: new Date().toISOString(),
    from: snapshot.level,
    to: pk.level,
    dice,
    expUsed: free ? 0 : need,
    free,
    rerollOnes: settings.rerollOnes,
    rolls,
    snapshot,
  };
  pk.levelLog.push(entry);
  return entry;
}

/** Macht das letzte Levelup exakt rückgängig. */
export function undoLevelUp(pk) {
  const entry = pk.levelLog.pop();
  if (!entry) return null;
  Object.assign(pk, {
    level: entry.snapshot.level,
    exp: entry.snapshot.exp,
    stats: { ...entry.snapshot.stats },
    currentHp: entry.snapshot.currentHp,
  });
  return entry;
}
