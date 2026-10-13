// Würfeln mit nachvollziehbarem Protokoll.
// Notation wie im Pen&Paper: "2W6" = zwei sechsseitige Würfel.

export function parseDice(notation) {
  const m = /^(\d+)\s*[WwDd]\s*(\d+)$/.exec(String(notation).trim());
  if (!m) throw new Error(`Ungültige Würfelangabe: ${notation}`);
  return { count: +m[1], sides: +m[2] };
}

const randomInt = (sides) => Math.floor(Math.random() * sides) + 1;

/**
 * Würfelt einen einzelnen Würfel. Bei rerollOnes wird jede 1 so lange neu
 * gewürfelt, bis keine 1 mehr fällt. faces enthält ALLE Würfe (für das Log).
 */
export function rollDie(sides, { rerollOnes = true, rng = randomInt } = {}) {
  const faces = [rng(sides)];
  if (rerollOnes && sides > 1) {
    while (faces[faces.length - 1] === 1) faces.push(rng(sides));
  }
  return { faces, value: faces[faces.length - 1] };
}

/** Würfelt z.B. "2W6" → { notation, dice: [{faces, value}], total } */
export function roll(notation, options) {
  const { count, sides } = parseDice(notation);
  const dice = Array.from({ length: count }, () => rollDie(sides, options));
  return { notation, dice, total: dice.reduce((s, d) => s + d.value, 0) };
}

/** "2W6: [1→1→4] + [5] = 9" – gestrichene 1en bleiben sichtbar. */
export function formatRoll(r) {
  const parts = r.dice.map((d) => `[${d.faces.join('→')}]`);
  return `${r.notation}: ${parts.join(' + ')} = ${r.total}`;
}
