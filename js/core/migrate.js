// Liest JSON-Dateien ein – sowohl das neue Format als auch Exporte der alten Seite
// (PokemonTriadsSheetCreator: exportType "pokemon_single" / "trainer_single").

import { getAbilities } from './data.js';
import { normalizePokemon, normalizeTrainer } from './model.js';

let abilityByDe = null;
async function abilitySlug(name) {
  if (!abilityByDe) {
    const all = await getAbilities();
    abilityByDe = Object.fromEntries(Object.entries(all).map(([slug, a]) => [a.n.toLowerCase(), slug]));
  }
  return abilityByDe[String(name).toLowerCase()] || name; // unbekannt → bleibt als eigener Text
}

async function fromOldPokemon(o) {
  const notes = (o.notes || []).map((n) => n.content).filter(Boolean).join('\n\n');
  return normalizePokemon({
    uuid: o._meta?.pokemonUuid,
    trainerId: o._meta?.trainerId || null,
    speciesId: o.pokemonId,
    nickname: o.textFields?.nickname || '',
    types: (o.types || []).map((t) => t.type?.name || t).filter(Boolean),
    level: o.level,
    exp: o.currentExp || 0,
    stats: { ...o.stats },
    currentHp: o.currentHp ?? o.stats?.hp,
    // GENA/PA entfallen – Accuracy/Evasion werden nach neuer Regel berechnet
    accuracy: null,
    evasion: null,
    levelUp: {
      primary: o.primaryStatChoice || 'hp',
      secondary: o.secondaryStatChoice || 'attack',
      diceOverride: o.customDiceClass || null,
    },
    // Eigene Attackentexte entfallen – es zählen die Original-Spieltexte
    moves: (o.moves || []).map((m) => m?.name || null),
    abilities: await Promise.all((o.abilities || []).filter(Boolean).map(abilitySlug)),
    item: o.textFields?.item || '',
    gender: o.gender || 'neutral',
    shiny: !!o.isShiny,
    friendship: Array.isArray(o.tallyMarks) ? o.tallyMarks.length : 0,
    // tempStatModifiers waren temporäre Absolutwerte → werden nicht übernommen
    status: Array.isArray(o.statusEffects) ? o.statusEffects.map(String) : [],
    notes,
    updatedAt: o._meta?.savedAt || o.timestamp,
  });
}

function fromOldTrainer(o) {
  const items = Object.values(o.inventory?.items || {}).flat()
    .filter((i) => i?.name)
    .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}${i.description ? ` – ${i.description}` : ''}`);
  const noteLines = Object.entries(o.notes?.entries || {}).flatMap(([cat, list]) =>
    list.filter((e) => e.name || e.ueberschrift || e.notizen)
      .map((e) => `[${o.notes.categoryNames?.[cat] || cat}] ${e.name || e.ueberschrift || ''}: ${e.notizen || ''}`));
  return normalizeTrainer({
    id: o.id,
    name: o.name || '',
    level: o.level || 1,
    team: (o.pokemonSlots || []).filter((s) => s.pokemonUuid).map((s) => ({ uuid: s.pokemonUuid, active: true })),
    inventory: items.join('\n'),
    notes: noteLines.join('\n'),
    updatedAt: o.timestamp,
  });
}

/** Wandelt beliebiges unterstütztes JSON in { trainers: [], pokemon: [] } um. */
export async function migrate(json) {
  if (json?.format === 'lokono-sheets') {
    return { trainers: json.trainers || [], pokemon: json.pokemon || [] };
  }
  if (json?.exportType === 'pokemon_single') {
    return { trainers: [], pokemon: [await fromOldPokemon(json)] };
  }
  if (json?.exportType === 'trainer_single') {
    const pokemon = await Promise.all(
      Object.values(json.pokemonFullData || {}).map((p) => fromOldPokemon({ ...p, timestamp: json.timestamp })));
    return { trainers: [fromOldTrainer(json)], pokemon };
  }
  throw new Error('Unbekanntes Dateiformat');
}
