// Zusatzeffekte von Attacken als deutsche Kurztexte (Daten: move.fx aus tools/build_data.py).

const AILMENTS = {
  paralysis: 'Paralyse',
  sleep: 'Schlaf',
  freeze: 'Einfrieren',
  burn: 'Verbrennung',
  poison: 'Vergiftung',
  'bad-poison': 'Schwere Vergiftung',
  confusion: 'Verwirrung',
  infatuation: 'Verliebt',
  trap: 'Gefangen',
  nightmare: 'Albtraum',
  torment: 'Folter',
  disable: 'Attacke blockiert',
  yawn: 'Gähnen (schläft nächste Runde ein)',
  'heal-block': 'Heilblockade',
  'no-type-immunity': 'Typ-Immunität aufgehoben',
  'leech-seed': 'Egelsamen',
  embargo: 'Itemsperre',
  'perish-song': 'Abgesang',
  ingrain: 'Verwurzelt',
  silence: 'Verstummt',
  'tar-shot': 'Teer (Feuer-Schwäche)',
};

const STAT_NAMES = {
  attack: 'Ang.',
  defense: 'Vert.',
  'special-attack': 'Sp. Ang.',
  'special-defense': 'Sp. Vert.',
  speed: 'Init.',
  accuracy: 'Genauigkeit',
  evasion: 'Ausweichen',
};

// Chance 0 heißt in den Spieldaten "tritt immer ein"
const chance = (c) => (c && c < 100 ? `${c} %: ` : '');

/** Liefert z.B. ["10 %: Einfrieren", "10 %: Zurückschrecken"] – leer, wenn nichts bekannt ist. */
export function describeMoveEffects(move) {
  const fx = move?.fx;
  if (!fx) return [];
  const out = [];
  if (fx.ail) out.push(`${chance(fx.ail[1])}${AILMENTS[fx.ail[0]] || fx.ail[0]}`);
  if (fx.fl) out.push(`${chance(fx.fl)}Zurückschrecken`);
  if (fx.st) {
    const [changes, c, who] = fx.st;
    const list = changes.map(([s, n]) => `${STAT_NAMES[s] || s} ${n > 0 ? '+' : '−'}${Math.abs(n)}`).join(', ');
    out.push(`${chance(c)}${list} (${who === 'user' ? 'Anwender' : 'Ziel'})`);
  }
  if (fx.hits) out.push(fx.hits[0] === fx.hits[1] ? `${fx.hits[0]} Treffer` : `${fx.hits[0]}–${fx.hits[1]} Treffer`);
  if (fx.drain > 0) out.push(`Absorbiert ${fx.drain} % des Schadens`);
  if (fx.drain < 0) out.push(`Rückstoß ${-fx.drain} % des Schadens`);
  if (fx.heal > 0) out.push(`Heilt ${fx.heal} % der max. KP`);
  if (fx.crit) out.push(fx.crit >= 3 ? 'Immer Volltreffer' : 'Erhöhte Volltrefferquote');
  return out;
}
