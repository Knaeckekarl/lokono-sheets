// Übersicht: Trainer & Pokémon, Neu anlegen, Import/Export.

import { esc, downloadJson, downloadBlob, readJsonFiles, today, safeName } from '../core/util.js';
import { listPokemon, listTrainers, saveTrainer, mergeImport, exportAll, bundle, teamOf } from '../core/store.js';
import { createZip } from '../core/zip.js';
import { createTrainer } from '../core/model.js';
import { migrate } from '../core/migrate.js';
import {
  pokedexMap, spriteImg, typeBadge, speciesDatalist, parseSpeciesInput, createAndSavePokemon,
} from './shared.js';

export async function render(app) {
  const root = document.createElement('div');
  app.replaceChildren(root);
  const [dex, dexList] = await Promise.all([pokedexMap(), speciesDatalist('dex-dl')]);

  const draw = () => {
    const trainers = listTrainers().sort((a, b) => a.name.localeCompare(b.name));
    const trainerName = Object.fromEntries(trainers.map((t) => [t.id, t.name || 'Unbenannt']));
    const filter = root.querySelector('#pk-filter')?.value.toLowerCase() || '';
    const pokemon = listPokemon()
      .map((pk) => ({ pk, sp: dex.get(pk.speciesId) }))
      .filter(({ pk, sp }) => `${pk.nickname} ${sp?.de} ${trainerName[pk.trainerId] || ''}`.toLowerCase().includes(filter))
      .sort((a, b) => (trainerName[a.pk.trainerId] || '~').localeCompare(trainerName[b.pk.trainerId] || '~')
        || (a.pk.nickname || a.sp?.de || '').localeCompare(b.pk.nickname || b.sp?.de || ''));

    root.querySelector('#trainer-list').innerHTML = trainers.map((t) => `
      <a class="tile tr-tile" href="#/trainer/${encodeURIComponent(t.id)}">
        ${t.portrait ? `<img class="tr-portrait" src="${esc(t.portrait)}" alt="">` : ''}
        <span>
          <strong>${esc(t.name || 'Unbenannt')}</strong>
          <span class="muted">${esc(t.class)} · Level ${t.level}</span>
          <span class="team-strip">${teamOf(t).map(({ pk }) => spriteImg(pk.speciesId, { shiny: pk.shiny, size: 40 })).join('')}</span>
        </span>
      </a>`).join('') || '<p class="muted">Noch keine Trainer.</p>';

    root.querySelector('#pokemon-list').innerHTML = pokemon.map(({ pk, sp }) => `
      <a class="tile pk-tile" href="#/pokemon/${encodeURIComponent(pk.uuid)}">
        ${spriteImg(pk.speciesId, { shiny: pk.shiny })}
        <span>
          <strong>${esc(pk.nickname || sp?.de || '?')}</strong>
          <span class="muted">${pk.nickname ? esc(sp?.de) + ' · ' : ''}Lv ${pk.level}${pk.trainerId ? ' · ' + esc(trainerName[pk.trainerId] || '?') : ''}</span>
          <span>${pk.types.map(typeBadge).join('')}</span>
        </span>
      </a>`).join('') || '<p class="muted">Keine Pokémon gefunden.</p>';

    root.querySelector('#new-trainer-select').innerHTML = `<option value="">– ohne Trainer –</option>` +
      trainers.map((t) => `<option value="${esc(t.id)}">${esc(t.name || 'Unbenannt')}</option>`).join('');
  };

  root.innerHTML = `
    ${dexList}
    <section class="card">
      <div class="row between"><h2>Trainer</h2><button data-act="new-trainer">+ Neuer Trainer</button></div>
      <div id="trainer-list" class="tiles"></div>
    </section>

    <section class="card">
      <div class="row between"><h2>Pokémon</h2><input id="pk-filter" type="search" placeholder="Suchen (Spitzname, Art, Trainer)"></div>
      <form id="new-pk" class="row wrap">
        <input name="species" list="dex-dl" placeholder="Art, z.B. Kanivanha" required autocomplete="off">
        <input name="nickname" placeholder="Spitzname (empfohlen)">
        <select name="trainer" id="new-trainer-select"></select>
        <button>+ Pokémon erstellen</button>
      </form>
      <div id="pokemon-list" class="tiles"></div>
    </section>

    <section class="card">
      <h2>Import / Export</h2>
      <p class="muted">Importiert neue <em>und</em> alte JSON-Dateien (PokemonTriadsSheetCreator). Bei mehreren Ständen desselben Pokémon gewinnt der neueste.</p>
      <div class="row wrap">
        <label class="button">Dateien importieren<input type="file" id="import-files" accept=".json" multiple hidden></label>
        <label class="button">Ordner importieren<input type="file" id="import-dir" webkitdirectory multiple hidden></label>
        <button data-act="export-all">Komplett-Backup exportieren</button>
        <button data-act="export-zip" title="ZIP mit je einer Datei pro Trainer und Pokémon – entpacken und per „Ordner importieren“ wieder einlesen">Backup als Einzeldateien (ZIP)</button>
      </div>
      <pre id="import-log" class="log-box" hidden></pre>
    </section>`;

  draw();

  root.querySelector('#pk-filter').addEventListener('input', draw);

  root.querySelector('#new-pk').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const id = await parseSpeciesInput(f.get('species'));
    if (!id) return alert('Pokémon nicht gefunden – bitte aus der Liste wählen.');
    const nickname = f.get('nickname').trim();
    const twin = listPokemon().find((p) => p.speciesId === id && p.nickname === nickname);
    if (twin && !confirm(`Es gibt bereits ein ${dex.get(id).de} mit ${nickname ? `Spitzname „${nickname}“` : 'ohne Spitzname'}. Trotzdem anlegen?`)) return;
    const pk = await createAndSavePokemon(id, { nickname, trainerId: f.get('trainer') || null });
    location.hash = `#/pokemon/${pk.uuid}`;
  });

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'new-trainer') {
      const t = createTrainer('Neuer Trainer');
      saveTrainer(t);
      location.hash = `#/trainer/${t.id}`;
    }
    if (act === 'export-all') downloadJson(`Lokono_Backup_${today()}.json`, exportAll());
    if (act === 'export-zip') downloadBlob(`Lokono_Backup_${today()}.zip`, createZip(backupFiles(dex)));
  });

  const doImport = async (e) => {
    const files = [...e.target.files].filter((f) => f.name.endsWith('.json'));
    const log = root.querySelector('#import-log');
    const all = { trainers: [], pokemon: [] };
    const lines = [];
    for (const { name, data, error } of await readJsonFiles(files)) {
      try {
        if (error) throw new Error(error);
        const r = await migrate(data);
        all.trainers.push(...r.trainers);
        all.pokemon.push(...r.pokemon);
      } catch (err) {
        lines.push(`✗ ${name}: ${err.message}`);
      }
    }
    const res = mergeImport(all);
    lines.unshift(`${files.length} Datei(en): ${res.added} neu, ${res.updated} aktualisiert, ${res.skipped} älter/unverändert übersprungen.`);
    log.textContent = lines.join('\n');
    log.hidden = false;
    e.target.value = '';
    draw();
  };
  root.querySelector('#import-files').addEventListener('change', doImport);
  root.querySelector('#import-dir').addEventListener('change', doImport);
}

/** Komplett-Backup als Einzeldateien: je Trainer (ohne Team) und je Pokémon eine Datei im Exportformat. */
function backupFiles(dex) {
  const used = new Set();
  const unique = (name) => {
    let n = name, i = 2;
    while (used.has(n.toLowerCase())) n = `${name}_${i++}`;
    used.add(n.toLowerCase());
    return n;
  };
  const file = (path, data) => ({ name: `${unique(path)}.json`, content: JSON.stringify(data, null, 2) });
  return [
    ...listTrainers().map((t) => file(`Trainer/Trainer_${safeName(t.name || 'Unbenannt')}`, bundle({ trainers: [t] }))),
    ...listPokemon().map((pk) => file(
      `Pokemon/Pokemon_${safeName(pk.nickname || dex.get(pk.speciesId)?.de || pk.speciesId)}_Lv${pk.level}`,
      bundle({ pokemon: [pk] }))),
  ];
}
