// Feste Anzeige-Konstanten (keine Spielregeln – die stehen in rules.js).

export const TYPES = {
  normal: { de: 'Normal', color: '#A8A878' },
  fire: { de: 'Feuer', color: '#F08030' },
  water: { de: 'Wasser', color: '#6890F0' },
  electric: { de: 'Elektro', color: '#F8D030' },
  grass: { de: 'Pflanze', color: '#78C850' },
  ice: { de: 'Eis', color: '#98D8D8' },
  fighting: { de: 'Kampf', color: '#C03028' },
  poison: { de: 'Gift', color: '#A040A0' },
  ground: { de: 'Boden', color: '#E0C068' },
  flying: { de: 'Flug', color: '#A890F0' },
  psychic: { de: 'Psycho', color: '#F85888' },
  bug: { de: 'Käfer', color: '#A8B820' },
  rock: { de: 'Gestein', color: '#B8A038' },
  ghost: { de: 'Geist', color: '#705898' },
  dragon: { de: 'Drache', color: '#7038F8' },
  dark: { de: 'Unlicht', color: '#705848' },
  steel: { de: 'Stahl', color: '#B8B8D0' },
  fairy: { de: 'Fee', color: '#EE99AC' },
};

// Reihenfolge wie auf dem Bogen; speed wird als "Initiative" angezeigt.
export const STATS = ['hp', 'speed', 'attack', 'defense', 'spAttack', 'spDefense'];
export const STAT_LABELS = {
  hp: 'KP',
  speed: 'Initiative',
  attack: 'Angriff',
  defense: 'Verteidigung',
  spAttack: 'Sp. Angriff',
  spDefense: 'Sp. Verteidigung',
};

export const MOVE_CATEGORIES = { physical: 'Physisch', special: 'Speziell', status: 'Status' };

export const STATUS_EFFECTS = [
  'Verbrannt', 'Vergiftet', 'Schwer vergiftet', 'Paralysiert',
  'Schlafend', 'Eingefroren', 'Verwirrt', 'Zurückgeschreckt', 'Verflucht',
];

export const GENDERS = { male: '♂', female: '♀', neutral: '○' };

// Ein Pokémon hat 1–2 Typen; ein dritter ist nur als Ausnahme (🔓 Custom-Form) möglich.
export const MAX_TYPES = 3;
// Ein Pokémon hat höchstens 3 Fähigkeiten.
export const MAX_ABILITIES = 3;

// Daggerheart-Trainerbogen (siehe PDF)
export const TRAINER_TRAITS = [
  ['agility', 'Agility', 'Sprint · Leap · Maneuver'],
  ['strength', 'Strength', 'Lift · Smash · Grapple'],
  ['finesse', 'Finesse', 'Control · Hide · Tinker'],
  ['instinct', 'Instinct', 'Perceive · Sense · Navigate'],
  ['presence', 'Presence', 'Charm · Perform · Deceive'],
  ['knowledge', 'Knowledge', 'Recall · Analyze · Comprehend'],
];

export const SPRITE = (id, shiny = false) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'shiny/' : ''}${id}.png`;

// Typ-Effektivität (ab Gen. 6): Angreifer → { Verteidiger: Faktor }. Nicht aufgeführt = ×1.
export const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** Schadensfaktor jedes Angriffstyps gegen die gegebene Typ-Kombination. */
export function defensiveMatchups(defTypes) {
  return Object.fromEntries(Object.keys(TYPE_CHART).map((atk) =>
    [atk, defTypes.reduce((f, def) => f * (TYPE_CHART[atk][def] ?? 1), 1)]));
}
