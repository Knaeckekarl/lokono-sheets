// Alle Spielregeln an EINER Stelle. Wer Regeln ändern will, ändert nur diese Datei
// (bzw. die Einstellungen in der App, die DEFAULT_SETTINGS überschreiben).

import { roll, expectedDie } from './dice.js';
import { STATS, MAX_TYPES, MAX_ABILITIES } from './constants.js';

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
  accEvaStart: 10,          // ab diesem Level …
  accEvaEvery: 5,           // … alle X Level einen Punkt für Accuracy ODER Evasion
  // "Stats an Level angleichen" (Startwerte der Regler im Dialog)
  levelStatFactor: 0.8,     // Stärke "normal": Anteil an den Statpunkten eines trainierten Pokémon (siehe LEVEL_STAT_STRENGTHS)
  // Anteil der Entwicklungs-Bonuswürfe, der in die Gesamtpunkte einfließt. Ein trainiertes Pokémon bekommt bei
  // jeder Entwicklung Bonuswürfe auf alle Stats; ein Teil davon steckt schon in den höheren Basiswerten der neuen Art.
  levelStatEvoShare: 0.45,
  levelStatFocusShare: 0.5, // Spezialisierung: Anteil der Punkte, der wie Levelups auf Primär-/Sekundärwahl verteilt wird
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
  // Ab Lv 10 alle 5 Level: ein Punkt für Accuracy oder Evasion (Vergabe per Dialog, siehe assignBonusPoint)
  if (isBonusLevel(pk.level, settings)) entry.bonusLevel = pk.level;
  pk.levelLog.push(entry);
  return entry;
}

// ---------------------------------------------------------------- Accuracy/Evasion-Punkte

export const isBonusLevel = (level, settings = DEFAULT_SETTINGS) =>
  level >= settings.accEvaStart && (level - settings.accEvaStart) % settings.accEvaEvery === 0;

/** Levelups, deren Accuracy/Evasion-Punkt noch nicht vergeben wurde. */
export const pendingBonusPoints = (pk) => pk.levelLog.filter((e) => e.bonusLevel && !e.bonusPoint);

/** Vergibt den Punkt eines Levelups an 'accuracy' oder 'evasion' (wird beim Rückgängigmachen mit zurückgenommen). */
export function assignBonusPoint(pk, entry, stat) {
  if (!entry.bonusLevel || entry.bonusPoint || !['accuracy', 'evasion'].includes(stat)) return false;
  entry.bonusPoint = stat;
  pk[stat] = (pk[stat] ?? 0) + 1;
  return true;
}

/** Macht den letzten Protokolleintrag (Levelup oder Entwicklung) exakt rückgängig. */
export function undoLevelUp(pk) {
  const entry = pk.levelLog.pop();
  if (!entry) return null;
  Object.assign(pk, structuredClone(entry.snapshot));
  if (entry.bonusPoint) pk[entry.bonusPoint] -= 1; // vergebenen Accuracy/Evasion-Punkt zurücknehmen
  return entry;
}

// ---------------------------------------------------------------- Entwicklung

/** Anzahl Bonuswürfe pro Statuswert: Lv 1–10 → 1, 11–20 → 2, … (wie auf der alten Seite) */
export const evolutionRollCount = (level) => Math.max(1, Math.ceil(level / 10));

/**
 * Ordnet Fähigkeiten der neuen Art zu: gleiche Position → gleiche Position,
 * versteckte → versteckte. Artfremde/eigene Fähigkeiten bleiben unverändert.
 */
export function mapAbilities(current, fromInfo, toInfo) {
  const normalsFrom = fromInfo.abilities.filter((a) => a !== fromInfo.hiddenAbility);
  const normalsTo = toInfo.abilities.filter((a) => a !== toInfo.hiddenAbility);
  const mapped = current.map((a) => {
    if (a && a === fromInfo.hiddenAbility && toInfo.hiddenAbility) return toInfo.hiddenAbility;
    const i = normalsFrom.indexOf(a);
    return i >= 0 ? normalsTo[i] ?? normalsTo[0] ?? a : a;
  });
  return [...new Set(mapped)];
}

/**
 * Entwickelt ein Pokémon. Level, EXP, Statuswerte, Attacken und Spitzname bleiben.
 * Bonus: jeder Statuswert bekommt evolutionRollCount(level) Würfe der NEUEN Würfelklasse (KP ×3).
 * @param {object} choice  Auswahl im Entwicklungs-Dialog
 *   abilities:  'replace' | 'keep' | [slugs]  (Liste = genau diese Fähigkeiten, in dieser Reihenfolge)
 *   customForm: null = Typen der neuen Art, sonst { types: [...], formName } → Custom-Form (schaltet 🔓 frei)
 *   dice:       undefined = Würfelklasse unverändert, null = Auto (neue Art), z.B. '2W8' = feste Klasse
 *   unlock:     true = 🔓 für dieses Pokémon aktivieren (untypische Auswahl im Dialog)
 */
export function evolve(pk, fromInfo, toInfo, settings, { abilities = 'replace', customForm = null, dice, unlock = false } = {}) {
  const snapshot = structuredClone({
    speciesId: pk.speciesId, types: pk.types, formName: pk.formName, unlocked: pk.unlocked,
    abilities: pk.abilities, stats: pk.stats, currentHp: pk.currentHp, levelUp: pk.levelUp,
  });
  // Würfelklasse gilt für den Bonus UND künftige Levelups (wie die Auswahl im Bogen)
  if (dice !== undefined) pk.levelUp.diceOverride = dice;
  const usedDice = pk.levelUp.diceOverride || diceClassFor(toInfo, settings).dice;
  const count = evolutionRollCount(pk.level);

  const rolls = STATS.map((stat) => {
    const dieRolls = Array.from({ length: count }, () => roll(usedDice, { rerollOnes: settings.rerollOnes }));
    const total = dieRolls.reduce((sum, r) => sum + r.total, 0);
    const mult = multiplierFor(stat, settings);
    const before = pk.stats[stat];
    pk.stats[stat] = before + total * mult;
    return { kind: 'Entwicklung', stat, rolls: dieRolls, total, mult, gain: total * mult, before, after: pk.stats[stat] };
  });
  pk.currentHp += pk.stats.hp - snapshot.stats.hp; // KP-Zuwachs kommt auch den aktuellen KP zugute

  pk.speciesId = toInfo.id;
  if (customForm) {
    pk.types = [...new Set(customForm.types.filter(Boolean))].slice(0, MAX_TYPES);
    pk.formName = customForm.formName || '';
  } else {
    pk.types = [...toInfo.types];
    pk.formName = '';
  }
  if (Array.isArray(abilities)) pk.abilities = abilities.slice(0, MAX_ABILITIES);
  else if (abilities === 'replace') pk.abilities = mapAbilities(pk.abilities, fromInfo, toInfo).slice(0, MAX_ABILITIES);
  // Eigene Typen, artfremde Fähigkeiten oder feste Würfelklasse sind Ausnahmen → ab jetzt freigeschaltet
  if (customForm || unlock) pk.unlocked = true;

  const entry = {
    type: 'evolution',
    at: new Date().toISOString(),
    from: pk.level,
    to: pk.level,
    fromSpecies: fromInfo.de,
    toSpecies: toInfo.de,
    dice: usedDice,
    count,
    rerollOnes: settings.rerollOnes,
    choice: { abilities, customForm, dice },
    rolls,
    snapshot,
  };
  pk.levelLog.push(entry);
  return entry;
}

// ---------------------------------------------------------------- Stats an Level angleichen

/** Feste Stufen alter Protokolleinträge (nur noch für deren Anzeige). */
export const LEVEL_STAT_TIERS = { weak: 'schwach', normal: 'normal', strong: 'stark', specialized: 'spezialisiert' };

/** Stufen des Stärke-Reglers: Anteil an den Statpunkten eines trainierten Pokémon. */
export const LEVEL_STAT_STRENGTHS = [
  { factor: 0.5, label: 'extrem schwach' },
  { factor: 0.6, label: 'sehr schwach' },
  { factor: 0.7, label: 'schwach' },
  { factor: 0.8, label: 'normal' },
  { factor: 0.9, label: 'stark' },
  { factor: 0.96, label: 'sehr stark' },
  { factor: 1.0, label: 'stark wie selbst trainiert' },
  { factor: 1.1, label: 'stärker als trainiert'},
  { factor: 1.2, label: 'stärker als die Polizei erlaubt'}
];

/** Index der Stärke-Stufe, die factor am nächsten liegt. */
export const strengthIndex = (factor) => LEVEL_STAT_STRENGTHS.reduce((best, x, i) =>
  (Math.abs(x.factor - factor) < Math.abs(LEVEL_STAT_STRENGTHS[best].factor - factor) ? i : best), 0);

/** "stark" – oder Prozentwert, falls factor keiner Stufe entspricht. */
export function strengthLabel(factor) {
  const s = LEVEL_STAT_STRENGTHS[strengthIndex(factor)];
  return Math.abs(s.factor - factor) < 1e-6 ? s.label : `${Math.round(factor * 100)} %`;
}

/** Entwicklungslevel der durchlaufenen Stufen; unbekannt (z.B. Stein) → Startlevel der Vorstufe. */
function evolutionLevels(info) {
  const evo = info.evo || {};
  if (!evo.stage || !evo.pre) return [];
  let at = 0;
  return [evo.firstLevel, evo.secondLevel].slice(0, evo.stage).map((lv) => (at = Math.max(lv || startLevel(evo.pre), at)));
}

/**
 * Erwartete Statsumme (KP ohne Multiplikator) eines per Levelup trainierten Pokémon dieser Art:
 * Spielformel auf dem Startlevel + 2 Würfe je weiterem Level + gewichtete Entwicklungsboni.
 */
export function expectedTrainedTotal(pk, info, settings) {
  const l0 = Math.min(pk.level, startLevel(info));
  const start = initialStats(info, l0, { ...settings, hpMultiplier: 1 });
  const die = expectedDie(effectiveDice(pk, info, settings), settings.rerollOnes);
  const evoRolls = evolutionLevels(info)
    .filter((lv) => lv <= pk.level)
    .reduce((sum, lv) => sum + STATS.length * evolutionRollCount(lv), 0);
  const base = Object.values(start).reduce((a, b) => a + b, 0);
  return base + (2 * (pk.level - l0) + evoRolls * settings.levelStatEvoShare) * die;
}

/**
 * Erwartete Würfe je Levelup (2 Würfe): Zufall trifft jeden Stat mit 1/6, die Primärwahl
 * bekommt den zweiten Wurf, außer der Zufall hat sie schon getroffen → dann die Sekundärwahl.
 * Primär 1, Sekundär 1/3, übrige je 1/6. Ohne Sekundärwahl bleibt der Wurf bei der Primärwahl.
 */
function levelUpShares([primary, secondary] = []) {
  const share = Object.fromEntries(STATS.map((s) => [s, 1 / 6]));
  if (primary) {
    share[primary] += 5 / 6;
    share[secondary || primary] += 1 / 6;
  }
  return share;
}

/**
 * Neue Statuswerte passend zum Level (ändert pk nicht → auch als Vorschau nutzbar).
 * Summe = erwartete Summe eines trainierten Pokémon × factor (Stärke).
 * focusShare der Punkte wird wie bei Levelups auf Stat 1 (Primär) und Stat 2 (Sekundär) verteilt,
 * der Rest nach Spielformel (Basiswerte). Fehlende Optionen → levelStat*-Werte aus den Einstellungen.
 */
export function levelStats(pk, info, settings, { factor, focus = [], evoShare, focusShare } = {}) {
  const evo = { ...settings, levelStatEvoShare: evoShare ?? settings.levelStatEvoShare };
  const total = expectedTrainedTotal(pk, info, evo) * (factor ?? settings.levelStatFactor);
  const focusPart = focus.some(Boolean) ? total * (focusShare ?? settings.levelStatFocusShare) : 0;
  const lv = pk.level;
  const weight = Object.fromEntries(STATS.map((s) => {
    const core = (2 * info.base[s] * lv) / 100;
    return [s, s === 'hp' ? core + lv + 10 : core + 5];
  }));
  const sum = Object.values(weight).reduce((a, b) => a + b, 0);
  const shares = levelUpShares(focus.filter(Boolean));
  return Object.fromEntries(STATS.map((s) => {
    const points = ((total - focusPart) * weight[s]) / sum + (focusPart * shares[s]) / 2;
    return [s, Math.max(1, Math.round(points)) * multiplierFor(s, settings)];
  }));
}

/** Ersetzt die Statuswerte durch levelStats() – mit Protokolleintrag, über undoLevelUp() rückgängig. */
export function adjustToLevel(pk, info, settings, options = {}) {
  const snapshot = { stats: { ...pk.stats }, currentHp: pk.currentHp };
  const focusUsed = (options.focus || []).filter(Boolean).slice(0, 2);
  const factor = options.factor ?? settings.levelStatFactor;
  const evoShare = options.evoShare ?? settings.levelStatEvoShare;
  const focusShare = focusUsed.length ? options.focusShare ?? settings.levelStatFocusShare : 0;
  pk.stats = levelStats(pk, info, settings, { factor, focus: focusUsed, evoShare, focusShare });
  pk.currentHp = pk.stats.hp;
  const entry = {
    type: 'adjust',
    at: new Date().toISOString(),
    from: pk.level,
    to: pk.level,
    factor,
    focus: focusUsed,
    focusShare,
    evoShare,
    changes: STATS.map((stat) => ({ stat, before: snapshot.stats[stat], after: pk.stats[stat] })),
    snapshot,
  };
  pk.levelLog.push(entry);
  return entry;
}
