// Trainer-Bogen im Stil des Daggerheart-PDFs ("Pokémon Lokono Trainer sheet.pdf").

import { esc, downloadJson, safeName, today, rerenderKeepingFocus } from '../core/util.js';
import { TRAINER_TRAITS } from '../core/constants.js';
import {
  getTrainer, saveTrainer, deleteTrainer, teamOf, listPokemon, getPokemon, savePokemon, bundle,
} from '../core/store.js';
import {
  pokedexMap, spriteImg, typeBadge, speciesDatalist, parseSpeciesInput, createAndSavePokemon, bindFields,
  boxTrack, clickTrack,
} from './shared.js';

export async function render(app, id) {
  const t = getTrainer(id);
  if (!t) throw new Error('Trainer nicht gefunden.');
  const [dex, dexList] = await Promise.all([pokedexMap(), speciesDatalist('dex-dl')]);

  const root = document.createElement('div');
  app.replaceChildren(root);
  root.innerHTML = `${dexList}<div id="sheet" class="sheet dh-sheet trainer-sheet"></div>`;
  const sheet = root.querySelector('#sheet');
  const boxes = boxTrack;

  const draw = () => {
    const team = teamOf(t);
    const free = listPokemon().filter((p) => p.trainerId !== t.id);
    sheet.innerHTML = `
      <header class="dh-head">
        <div class="dh-title"><b>POKÉMON-TRAINER</b><span>CHARACTER SHEET</span></div>
        <div class="dh-fields">
          <label><small>NAME</small><input data-f="name" value="${esc(t.name)}"></label>
          <label><small>PRONOUNS</small><input data-f="pronouns" value="${esc(t.pronouns)}"></label>
          <label><small>CLASS</small><input data-f="class" value="${esc(t.class)}"></label>
          <label><small>BOON</small><input data-f="boon" value="${esc(t.boon)}"></label>
        </div>
        <label class="shield level"><input type="number" min="1" data-f="level" data-t="num" data-rerender value="${t.level}"><small>LEVEL</small></label>
      </header>

      <div class="dh-traits">
        <label class="shield"><input type="number" data-f="evasion" data-t="num" value="${t.evasion}"><small>EVASION</small></label>
        <label class="shield"><input type="number" data-f="capacity" data-t="num" value="${t.capacity}"><small>CAPACITY</small></label>
        <div class="balls">${t.capacitySlots.map((on, i) => `<button class="ball ${on ? 'on' : ''}" data-slot="${i}" aria-label="Slot ${i + 1}"></button>`).join('')}</div>
        ${TRAINER_TRAITS.map(([k, label, sub]) => `
          <div class="trait">
            <div class="banner">${label}<input type="checkbox" data-f="traitMarks.${k}" ${t.traitMarks[k] ? 'checked' : ''} title="markiert"></div>
            <input type="number" class="trait-val" data-f="traits.${k}" data-t="num" value="${t.traits[k]}">
            <small>${sub.replaceAll(' · ', '<br>')}</small>
          </div>`).join('')}
      </div>

      <div class="dh-cols">
        <div class="dh-col">
          <section class="dh-sec">
            <h3 class="dh-banner">DAMAGE &amp; HEALTH</h3>
            <p class="small center">Add your current level to your damage thresholds.</p>
            <div class="thresholds">
              <div class="th"><b>MINOR<br>DAMAGE</b><small>Mark 1 HP</small></div>
              <label class="th-val"><input type="number" data-f="thresholds.major" data-t="num" data-rerender value="${t.thresholds.major}" title="Basiswert">
                <output>${t.thresholds.major + t.level}</output></label>
              <div class="th"><b>MAJOR<br>DAMAGE</b><small>Mark 2 HP</small></div>
              <label class="th-val"><input type="number" data-f="thresholds.severe" data-t="num" data-rerender value="${t.thresholds.severe}" title="Basiswert">
                <output>${t.thresholds.severe + t.level}</output></label>
              <div class="th"><b>SEVERE<br>DAMAGE</b><small>Mark 3 HP</small></div>
            </div>
            <div class="track"><b>HP</b>${boxes('hp', t.hp.max, t.hp.marked)}
              <input type="number" min="1" max="12" data-f="hp.max" data-t="num" data-rerender value="${t.hp.max}" title="Max. HP-Slots"></div>
            <div class="track"><b>STRESS</b>${boxes('stress', t.stress.max, t.stress.marked)}
              <input type="number" min="1" max="12" data-f="stress.max" data-t="num" data-rerender value="${t.stress.max}" title="Max. Stress-Slots"></div>
          </section>

          <section class="dh-sec">
            <h3 class="dh-banner">HOPE</h3>
            <p class="small center">Spend a Hope to use an experience or help an ally.</p>
            <div class="hope">${boxes('hope', 6, t.hope, 'diamond')}</div>
            <label class="line"><small>HOPE FEATURE</small><input data-f="hopeFeature" value="${esc(t.hopeFeature)}"></label>
          </section>

          <section class="dh-sec">
            <h3 class="dh-banner">EXPERIENCE</h3>
            ${t.experiences.map((x, i) => `
              <div class="exp-row">
                <input data-f="experiences.${i}.text" value="${esc(x.text)}">
                <input type="number" class="bonus" data-f="experiences.${i}.bonus" data-t="num" value="${x.bonus}">
                <button class="mini no-print" data-act="del-exp" data-i="${i}" title="Entfernen">×</button>
              </div>`).join('')}
            <button class="no-print" data-act="add-exp">+ Experience</button>
          </section>

          <section class="dh-sec">
            <h3 class="dh-banner">CLASS FEATURES</h3>
            ${t.classFeatures.map((cf, i) => `
              <div class="cf-item">
                <div class="cf-head">
                  <input class="cf-name" data-f="classFeatures.${i}.name" value="${esc(cf.name)}" placeholder="Name des Features">
                  <button class="mini no-print" data-act="del-cf" data-i="${i}" title="Feature entfernen">×</button>
                </div>
                <textarea class="cf-effect" data-f="classFeatures.${i}.effect" rows="5" placeholder="Effekt">${esc(cf.effect)}</textarea>
              </div>`).join('')}
            <button class="no-print" data-act="add-cf">+ Class Feature</button>
          </section>
        </div>

        <div class="dh-col">
          <section class="dh-sec">
            <h3 class="dh-banner">TEAM</h3>
            <div class="badges"><b>BADGES</b>${t.badges.map((on, i) => `<button class="badge-dot ${on ? 'on' : ''}" data-badge="${i}" aria-label="Orden ${i + 1}"></button>`).join('')}</div>
            <div class="team-head"><span></span><small>ACTIVE</small></div>
            ${team.map(({ pk, active }) => {
              const sp = dex.get(pk.speciesId);
              return `
              <div class="team-row ${active ? '' : 'inactive'}">
                ${spriteImg(pk.speciesId, { shiny: pk.shiny, size: 40 })}
                <a href="#/pokemon/${encodeURIComponent(pk.uuid)}" class="grow">
                  <b>${esc(pk.nickname || sp?.de || '?')}</b>
                  <span class="muted">${pk.nickname ? esc(sp?.de) + ' · ' : ''}Lv ${pk.level} · KP ${pk.currentHp}/${pk.stats.hp}</span>
                  ${pk.types.map(typeBadge).join('')}
                </a>
                <input type="checkbox" data-active="${esc(pk.uuid)}" ${active ? 'checked' : ''} title="Aktiv im Team">
                <button class="mini no-print" data-act="release" data-uuid="${esc(pk.uuid)}" title="Aus Team entfernen">×</button>
              </div>`;
            }).join('') || '<p class="muted">Noch keine Pokémon.</p>'}
            <form class="row wrap no-print" id="add-new">
              <input name="species" list="dex-dl" placeholder="Neues Pokémon: Art" required autocomplete="off">
              <input name="nickname" placeholder="Spitzname">
              <button>+ Neu</button>
            </form>
            ${free.length ? `
            <div class="row wrap no-print">
              <select id="assign-select">${free.map((p) =>
                `<option value="${esc(p.uuid)}">${esc(p.nickname || dex.get(p.speciesId)?.de || '?')} (Lv ${p.level})</option>`).join('')}</select>
              <button data-act="assign">Vorhandenes zuordnen</button>
            </div>` : ''}
          </section>

          <section class="dh-sec">
            <h3 class="dh-banner">INVENTORY</h3>
            <textarea class="lined" data-f="inventory" rows="14">${esc(t.inventory)}</textarea>
          </section>

          <section class="dh-sec">
            <h3 class="dh-banner">NOTES</h3>
            <textarea class="lined" data-f="notes" rows="6">${esc(t.notes)}</textarea>
          </section>
        </div>
      </div>

      <div class="row wrap no-print sheet-actions">
        <button data-act="export">Export (inkl. Team)</button>
        <button data-act="print">Drucken</button>
        <button data-act="delete" class="danger">Trainer löschen</button>
      </div>`;
  };

  bindFields(sheet, () => t, { save: saveTrainer, rerender: () => rerenderKeepingFocus(sheet, draw) });

  const setTeamFlag = (uuid, active) => {
    const entry = t.team.find((m) => m.uuid === uuid);
    if (entry) entry.active = active;
    else t.team.push({ uuid, active });
  };

  sheet.addEventListener('change', (e) => {
    const uuid = e.target.dataset.active;
    if (!uuid) return;
    setTeamFlag(uuid, e.target.checked);
    saveTrainer(t);
    draw();
  });

  sheet.addEventListener('click', (e) => {
    const el = e.target.closest('button');
    if (!el || el.form) return;
    const d = el.dataset;
    if (d.track) {
      // Klick auf ein Kästchen: bis dahin markieren; Klick auf das letzte markierte: eins zurück
      if (d.track === 'hope') t.hope = clickTrack(t.hope, +d.i);
      else t[d.track].marked = clickTrack(t[d.track].marked, +d.i);
    } else if (d.slot) t.capacitySlots[d.slot] = !t.capacitySlots[d.slot];
    else if (d.badge) t.badges[d.badge] = !t.badges[d.badge];
    else if (d.act === 'add-exp') t.experiences.push({ text: '', bonus: 2 });
    else if (d.act === 'del-exp') t.experiences.splice(+d.i, 1);
    else if (d.act === 'add-cf') t.classFeatures.push({ name: '', effect: '' });
    else if (d.act === 'del-cf') {
      const cf = t.classFeatures[+d.i];
      if ((cf.name || cf.effect) && !confirm(`Class Feature „${cf.name || 'ohne Namen'}“ entfernen?`)) return;
      t.classFeatures.splice(+d.i, 1);
    }
    else if (d.act === 'assign') {
      const pk = getPokemon(sheet.querySelector('#assign-select').value);
      pk.trainerId = t.id;
      savePokemon(pk);
      setTeamFlag(pk.uuid, true);
    } else if (d.act === 'release') {
      const pk = getPokemon(d.uuid);
      if (!confirm(`${pk.nickname || 'Pokémon'} aus dem Team entfernen? (Es bleibt in der Übersicht erhalten.)`)) return;
      pk.trainerId = null;
      savePokemon(pk);
      t.team = t.team.filter((m) => m.uuid !== d.uuid);
    } else if (d.act === 'export') {
      return downloadJson(`Trainer_${safeName(t.name)}_${today()}.json`,
        bundle({ trainers: [t], pokemon: teamOf(t).map((x) => x.pk) }));
    } else if (d.act === 'print') return window.print();
    else if (d.act === 'delete') {
      if (!confirm(`Trainer ${t.name} löschen? Die Pokémon bleiben erhalten.`)) return;
      deleteTrainer(t.id);
      location.hash = '#/';
      return;
    } else return;
    saveTrainer(t);
    draw();
  });

  sheet.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const speciesId = await parseSpeciesInput(f.get('species'));
    if (!speciesId) return alert('Pokémon nicht gefunden – bitte aus der Liste wählen.');
    const pk = await createAndSavePokemon(speciesId, { trainerId: t.id, nickname: f.get('nickname').trim() });
    setTeamFlag(pk.uuid, true);
    saveTrainer(t);
    draw();
  });

  draw();
}
