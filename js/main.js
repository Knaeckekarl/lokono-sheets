// Einstiegspunkt: einfacher Hash-Router. Views werden erst bei Bedarf geladen.
//   #/                → Übersicht
//   #/pokemon/<uuid>  → Pokémon-Bogen
//   #/trainer/<id>    → Trainer-Bogen
//   #/settings        → Regeln & Würfel
//   #/homebrew        → eigene Pokémon/Attacken/Fähigkeiten

import { esc } from './core/util.js';

const views = {
  '': () => import('./views/home.js'),
  pokemon: () => import('./views/pokemon.js'),
  trainer: () => import('./views/trainer.js'),
  settings: () => import('./views/settings.js'),
  homebrew: () => import('./views/homebrew.js'),
};

const app = document.getElementById('app');

async function route() {
  const [name = '', id = ''] = location.hash.replace(/^#\/?/, '').split('/');
  try {
    const view = await (views[name] || views[''])();
    await view.render(app, decodeURIComponent(id));
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card error"><h2>Fehler</h2><p>${esc(e.message)}</p><a href="#/">Zur Übersicht</a></div>`;
  }
}

addEventListener('hashchange', route);
route();

// Farbschema: Auto (System) → Hell → Dunkel
const THEMES = [['auto', '◐ Auto'], ['light', '☀ Hell'], ['dark', '☾ Dunkel']];
const themeBtn = document.getElementById('theme-toggle');
const showTheme = () => {
  const cur = document.documentElement.dataset.theme || 'auto';
  themeBtn.textContent = THEMES.find(([k]) => k === cur)[1];
};
themeBtn.addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || 'auto';
  const next = THEMES[(THEMES.findIndex(([k]) => k === cur) + 1) % THEMES.length][0];
  if (next === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  try {
    if (next === 'auto') localStorage.removeItem('lokono-theme');
    else localStorage.setItem('lokono-theme', next);
  } catch { /* ohne Speicher gilt die Wahl nur bis zum Neuladen */ }
  showTheme();
});
showTheme();
