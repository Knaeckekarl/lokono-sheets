// Pokémon-Bogen in der Optik des Daggerheart-Trainerbogens (nur Design – Inhalte sind Pokémon-Werte).

import { esc, downloadJson, safeName, today, uid, rerenderKeepingFocus } from '../core/util.js';
import {
  STATS, STAT_LABELS, MOVE_CATEGORIES, STATUS_EFFECTS, GENDERS, defensiveMatchups,
} from '../core/constants.js';
import { getSpecies, getMoves, getAbilities } from '../core/data.js';
import {
  getPokemon, savePokemon, deletePokemon, listPokemon, listTrainers, getSettings, bundle,
} from '../core/store.js';
import {
  diceClassFor, effectiveDice, expForNextLevel, possibleLevelUps, levelUp, undoLevelUp,
  calcAccuracy, calcEvasion, BATTLE_STATS, battleValue, heal,
  evolve, evolutionRollCount, mapAbilities,
} from '../core/rules.js';
import { describeMoveEffects } from '../core/effects.js';
import { isCustomForm, allowedGenders, learnableMoves } from '../core/model.js';
import {
  spriteImg, typeBadge, typeOptions, bindFields, dhBanner, boxTrack, clickTrack,
} from './shared.js';

const BATTLE_LABELS = { ...STAT_LABELS, initiative: 'Kampf-Init.' };

export async function render(app, uuid) {
  const pk = getPokemon(uuid);
  if (!pk) throw new Error('Pokémon nicht gefunden.');

  // Alles parallel laden – Daten kommen nach dem ersten Besuch aus dem Cache
  const [info, moves, abilities] = await Promise.all([getSpecies(pk.speciesId), getMoves(), getAbilities()]);
  const settings = getSettings();

  // Fehlende abgeleitete Werte (z.B. nach Import) einmalig berechnen
  pk.accuracy ??= calcAccuracy(info);
  pk.evasion ??= calcEvasion(info);

  const moveByName = new Map(Object.entries(moves).map(([slug, m]) => [m.n.toLowerCase(), slug]));
  const abilityByName = new Map(Object.entries(abilities).map(([slug, a]) => [a.n.toLowerCase(), slug]));
  const learnable = info.learn.level;
  const canLearn = learnableMoves(info);
  const genders = allowedGenders(info);

  const root = document.createElement('div');
  app.replaceChildren(root);
  // Datalists nur einmal bauen (groß), der Bogen selbst wird bei Änderungen neu gezeichnet
  root.innerHTML = `
    <datalist id="move-dl">${moveOptions(moves, info)}</datalist>
    <datalist id="move-dl-species">${moveOptions(moves, info, canLearn)}</datalist>
    <datalist id="ability-dl">${Object.values(abilities).map((a) => `<option value="${esc(a.n)}">`).join('')}</datalist>
    <datalist id="ability-dl-species">${info.abilities.map((a) => `<option value="${esc(abilities[a]?.n || a)}">`).join('')}</datalist>
    <div id="sheet" class="sheet dh-sheet pokemon-sheet"></div>
    <dialog id="evo-dlg" class="evo-dlg"></dialog>`;
  const sheet = root.querySelector('#sheet');
  const save = (m) => savePokemon(m);

  const draw = () => {
    const dc = diceClassFor(info, settings);
    const need = expForNextLevel(pk.level);
    const possible = possibleLevelUps(pk);
    const custom = isCustomForm(pk, info);
    const twin = listPokemon().find((p) => p.uuid !== pk.uuid && p.speciesId === pk.speciesId && p.nickname === pk.nickname);
    const lock = pk.unlocked ? '' : 'disabled title="Gesperrt – „Untypische Änderungen erlauben“ aktivieren"';
    const hpPct = pk.stats.hp ? Math.max(0, Math.min(100, (pk.currentHp / pk.stats.hp) * 100)) : 0;
    const fMax = settings.friendshipMax;

    sheet.style.setProperty('--accent', `var(--t-${pk.types[0] || 'normal'})`);
    sheet.innerHTML = `
      <div class="sheet-toolbar no-print">
        ${pk.trainerId ? `<a class="button" href="#/trainer/${encodeURIComponent(pk.trainerId)}">→ Trainer</a>` : ''}
        <span class="grow"></span>
        <button data-act="export" title="Als JSON-Datei speichern">Export</button>
        <button data-act="duplicate">Duplizieren</button>
        <button data-act="print">Drucken</button>
        <button data-act="delete" class="danger">Löschen</button>
      </div>
      <header class="dh-head">
        <div class="dh-title"><b>POKÉMON</b><span>CHARACTER SHEET</span></div>
        <div class="pk-sprite">${spriteImg(pk.speciesId, { shiny: pk.shiny, size: 96 })}</div>
        <div class="dh-fields">
          <label><small>NAME</small><input data-f="nickname" value="${esc(pk.nickname)}" placeholder="Spitzname"></label>
          <label><small>ART</small><span class="field-text">#${info.id} ${esc(info.de)}
            ${info.homebrew ? '<span class="badge">Homebrew</span>' : ''}
            ${custom ? `<span class="badge custom">Custom-Form${pk.formName ? ': ' + esc(pk.formName) : ''}</span>` : ''}</span></label>
          <label><small>TRAINER</small>
            <select data-f="trainerId" data-t="nullable" data-rerender>
              <option value="">– keiner –</option>
              ${listTrainers().map((t) => `<option value="${esc(t.id)}" ${t.id === pk.trainerId ? 'selected' : ''}>${esc(t.name || 'Unbenannt')}</option>`).join('')}
            </select></label>
          <label><small>ITEM</small><input data-f="item" value="${esc(pk.item)}"></label>
        </div>
        <label class="shield level"><input type="number" min="1" max="100" data-f="level" data-t="num" data-rerender value="${pk.level}"><small>LEVEL</small></label>
      </header>

      <div class="dh-subhead">
        ${twin ? `<span class="warn">⚠ Ein anderes ${esc(info.de)} heißt ebenfalls „${esc(pk.nickname)}“.</span>` : ''}
        <label>Typ <select data-f="types.0" data-rerender ${lock}>${typeOptions(pk.types[0])}</select></label>
        <select data-f="types.1" data-rerender ${lock} aria-label="Typ 2">${typeOptions(pk.types[1] || '', true)}</select>
        <span>${pk.types.map(typeBadge).join('')}</span>
        ${custom && pk.unlocked ? `
          <input data-f="formName" value="${esc(pk.formName)}" placeholder="Name der Form">
          <button data-act="reset-types" title="Original: ${info.types.join('/')}">↺ Original-Typen</button>` : ''}
        <label>Geschlecht <select data-f="gender">${Object.entries(GENDERS).map(([k, s]) =>
          `<option value="${k}" ${k === pk.gender ? 'selected' : ''} ${pk.unlocked || genders.includes(k) ? '' : 'disabled'}>${s}</option>`).join('')}</select></label>
        <label><input type="checkbox" data-f="shiny" data-rerender ${pk.shiny ? 'checked' : ''}> Shiny</label>
        <span class="muted small">${info.height / 10} m · ${info.weight / 10} kg · BST ${info.bst}</span>
        <label class="unlock no-print ${pk.unlocked ? 'on' : ''}" title="Erlaubt für DIESES Pokémon: andere Typen, artfremde Fähigkeiten und Attacken, eigene Würfelklasse, jedes Geschlecht">
          <input type="checkbox" data-f="unlocked" data-rerender ${pk.unlocked ? 'checked' : ''}>
          ${pk.unlocked ? '🔓' : '🔒'} Untypische Änderungen erlauben
        </label>
      </div>

      <div class="dh-traits">
        <label class="shield"><input type="number" data-f="accuracy" data-t="num" value="${pk.accuracy}"><small>ACCURACY</small></label>
        <label class="shield"><input type="number" data-f="evasion" data-t="num" value="${pk.evasion}"><small>EVASION</small></label>
        ${STATS.map((s) => `
          <label class="trait">
            <span class="banner">${STAT_LABELS[s]}</span>
            <input type="number" min="0" class="trait-val" data-f="stats.${s}" data-t="num" data-rerender value="${pk.stats[s]}">
            <small>Basis ${info.base[s]}</small>
          </label>`).join('')}
      </div>

      <div class="dh-cols">
        <div class="dh-col">
          <section class="dh-sec">
            ${dhBanner('KP &amp; Zustand')}
            <div class="hp-line">
              <b>KP</b>
              <input type="number" min="0" data-f="currentHp" data-t="num" data-rerender value="${pk.currentHp}" aria-label="KP aktuell">
              <span class="muted">/ ${pk.stats.hp}</span>
              <button class="heal-btn no-print" data-act="heal" title="KP auffüllen, Kampfwerte zurücksetzen, Statusprobleme entfernen">❤ Heilen</button>
            </div>
            <div class="hp-bar ${hpPct <= 25 ? 'low' : hpPct <= 50 ? 'mid' : ''}"><span style="width:${hpPct}%"></span></div>
            <div class="row wrap">
              ${STATUS_EFFECTS.map((s) => `<label class="chip"><input type="checkbox" data-status="${esc(s)}" ${pk.status.includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}
            </div>
          </section>

          <section class="dh-sec">
            ${dhBanner('Kampfwerte')}
            <p class="muted small center">Momentaufnahme: + / − verändert um je ${pk.level} (Level). Die Statuswerte oben bleiben unverändert.</p>
            <div class="bt-row bt-head"><span></span><small>Basis</small><small>Aktuell</small></div>
            ${BATTLE_STATS.map((s) => battleRow(pk, s)).join('')}
            <div class="row no-print"><button data-act="battle-reset">↺ Alle Kampfwerte zurücksetzen</button></div>
          </section>

          <section class="dh-sec">
            ${dhBanner('Freundschaft')}
            <div class="track"><b>${pk.friendship} / ${fMax}</b>${boxTrack('friendship', fMax, pk.friendship)}</div>
          </section>

          <section class="dh-sec">
            ${dhBanner('Level &amp; Erfahrung')}
            <div class="row wrap">
              <label>EXP <input type="number" min="0" data-f="exp" data-t="num" data-rerender value="${pk.exp}"></label>
              <span class="muted">nächstes Level: ${need}</span>
              <label title="${esc(dc.steps.join('\n'))}">Würfel
                <select data-f="levelUp.diceOverride" data-t="nullable" data-rerender ${lock}>
                  <option value="">Auto (${dc.dice})</option>
                  ${settings.diceLadder.map((d) => `<option ${d === pk.levelUp.diceOverride ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </label>
            </div>
            <details class="dc-why"><summary>Warum ${dc.dice}?</summary><ul>${dc.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></details>
            <div class="row wrap">
              <label>Primär <select data-f="levelUp.primary" data-rerender>${statOptions(pk.levelUp.primary)}</select></label>
              <label>Sekundär <select data-f="levelUp.secondary" data-rerender>${statOptions(pk.levelUp.secondary, pk.levelUp.primary)}</select></label>
            </div>
            <div class="row wrap no-print">
              ${possible > 1 ? `
                <select id="lvl-qty" aria-label="Anzahl Levelups">${Array.from({ length: possible }, (_, i) =>
                  `<option value="${i + 1}" ${i + 1 === possible ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>` : ''}
              <button data-act="levelup" class="primary" ${possible ? '' : 'disabled'}>⬆ ${possible > 1 ? 'Levelups' : 'Levelup'}</button>
              <button data-act="levelup-free" ${pk.level < 100 ? '' : 'disabled'} title="Level ohne EXP-Kosten, z.B. vom Spielleiter">+1 Level ohne EXP</button>
              <button data-act="undo" ${pk.levelLog.length ? '' : 'disabled'} title="Letztes Levelup bzw. letzte Entwicklung rückgängig machen">↶ Rückgängig</button>
              ${info.evo?.next?.length ? '<button data-act="evolve" title="Entwicklung auswählen">✨ Entwickeln</button>' : ''}
            </div>
            <p class="muted small">${possible ? `${possible} Levelup${possible > 1 ? 's' : ''} möglich · ` : ''}Würfel ${effectiveDice(pk, info, settings)} · ${settings.rerollOnes ? '1en werden neu gewürfelt' : '1en zählen'} · KP ×${settings.hpMultiplier} · Initiative ×${settings.speedMultiplier}</p>
          </section>

          <section class="dh-sec">
            ${dhBanner('Schwächen &amp; Resistenzen')}
            ${weaknesses(pk.types)}
          </section>
        </div>

        <div class="dh-col">
          <section class="dh-sec">
            ${dhBanner('Attacken')}
            ${pk.unlocked ? '' : `<p class="muted small center">🔒 Nur Attacken, die ${esc(info.de)} lernen kann.</p>`}
            ${pk.moves.map((slug, i) => moveRow(slug, i, moves, learnable, canLearn, pk.unlocked)).join('')}
          </section>

          <section class="dh-sec">
            ${dhBanner('Fähigkeiten')}
            <p class="muted small">Spiel-Fähigkeiten: ${info.abilities.map((a) =>
              `${esc(abilities[a]?.n || a)}${a === info.hiddenAbility ? ' (versteckt)' : ''}`).join(', ') || '–'}</p>
            ${pk.abilities.map((a, i) => abilityRow(a, i, abilities, info, pk.unlocked)).join('')}
            <button data-act="add-ability" class="no-print">+ Fähigkeit</button>
          </section>

          <section class="dh-sec">
            ${dhBanner('Notizen')}
            <textarea class="lined" data-f="notes" rows="8">${esc(pk.notes)}</textarea>
          </section>
        </div>
      </div>

      <section class="dh-sec dh-wide">
        ${dhBanner('Levelup-Protokoll')}
        ${pk.levelLog.length ? `<ol class="level-log" reversed>${[...pk.levelLog].reverse().map(logEntry).join('')}</ol>` : '<p class="muted center">Noch keine Levelups mit diesem Tool.</p>'}
      </section>`;
  };

  const redraw = () => rerenderKeepingFocus(sheet, draw);

  bindFields(sheet, () => pk, {
    save: (m) => {
      m.types = m.types.filter(Boolean); // "—" bei Typ 2 entfernt den Typ
      if (m.levelUp.secondary === m.levelUp.primary) {
        m.levelUp.secondary = STATS.find((s) => s !== m.levelUp.primary);
      }
      save(m);
    },
    rerender: redraw,
  });

  sheet.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.move != null) {
      const v = el.value.trim();
      const slug = v ? moveByName.get(v.toLowerCase()) : null;
      if (v && !slug) {
        alert(`„${v}“ ist keine bekannte Attacke. Eigene Attacken bitte im Homebrew-Editor anlegen.`);
        el.value = moves[pk.moves[el.dataset.move]]?.n || '';
        return;
      }
      if (slug && !pk.unlocked && !canLearn.has(slug)) {
        alert(`${info.de} kann „${v}“ nicht lernen. Für artfremde Attacken „Untypische Änderungen erlauben“ aktivieren.`);
        el.value = moves[pk.moves[el.dataset.move]]?.n || '';
        return;
      }
      pk.moves[el.dataset.move] = slug;
    } else if (el.dataset.ability != null) {
      const v = el.value.trim();
      const slug = abilityByName.get(v.toLowerCase());
      if (v && !slug) {
        alert(`„${v}“ ist keine bekannte Fähigkeit. Eigene Fähigkeiten bitte im Homebrew-Editor anlegen.`);
        el.value = abilities[pk.abilities[el.dataset.ability]]?.n || pk.abilities[el.dataset.ability] || '';
        return;
      }
      if (slug && !pk.unlocked && !info.abilities.includes(slug)) {
        alert(`„${v}“ ist keine Fähigkeit von ${info.de}. Für artfremde Fähigkeiten „Untypische Änderungen erlauben“ aktivieren.`);
        el.value = abilities[pk.abilities[el.dataset.ability]]?.n || pk.abilities[el.dataset.ability] || '';
        return;
      }
      if (slug) pk.abilities[el.dataset.ability] = slug;
      else pk.abilities.splice(+el.dataset.ability, 1);
    } else if (el.dataset.status != null) {
      const s = el.dataset.status;
      pk.status = el.checked ? [...pk.status, s] : pk.status.filter((x) => x !== s);
    } else if (el.dataset.battleInit != null) {
      // Zu Kampfbeginn real gewürfelte Initiative
      pk.battle.initiative = el.value === '' ? null : +el.value;
    } else return;
    save(pk);
    redraw();
  });

  sheet.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const d = btn.dataset;

    // Kampfwerte ±Level / Reset, Freundschafts-Kästchen
    if (d.bmod) pk.battle.mods[d.bmod] += +d.step;
    else if (d.breset) pk.battle.mods[d.breset] = 0;
    else if (d.track === 'friendship') pk.friendship = clickTrack(pk.friendship, +d.i);
    if (d.bmod || d.breset || d.track) {
      save(pk);
      draw();
      return;
    }

    const act = d.act;
    if (!act) return;
    const actions = {
      levelup() {
        // Gewählte Anzahl (Standard: alle möglichen) – jedes Level einzeln protokolliert
        const qty = +(sheet.querySelector('#lvl-qty')?.value || 1);
        for (let i = 0; i < qty && levelUp(pk, info, settings); i++);
      },
      'levelup-free'() {
        levelUp(pk, info, settings, { free: true });
      },
      undo() {
        const last = pk.levelLog.at(-1);
        if (!last) return;
        if (last.type === 'evolution') {
          if (!confirm(`Entwicklung ${last.fromSpecies} → ${last.toSpecies} rückgängig machen?`)) return 'navigated';
          undoLevelUp(pk);
          save(pk);
          render(app, uuid); // Art hat sich geändert → Bogen mit alten Artdaten neu laden
          return 'navigated';
        }
        if (confirm(`Levelup Lv ${last.from} → ${last.to} rückgängig machen?`)) undoLevelUp(pk);
      },
      evolve() {
        openEvolution();
        return 'navigated';
      },
      heal() {
        heal(pk);
      },
      'battle-reset'() {
        for (const s of BATTLE_STATS) pk.battle.mods[s] = 0;
      },
      'reset-types'() {
        pk.types = [...info.types];
        pk.formName = '';
      },
      'add-ability'() {
        pk.abilities.push('');
      },
      export() {
        downloadJson(`Pokemon_${safeName(pk.nickname || info.de)}_Lv${pk.level}_${today()}.json`, bundle({ pokemon: [pk] }));
      },
      duplicate() {
        const copy = structuredClone(pk);
        Object.assign(copy, { uuid: uid('pk'), nickname: `${pk.nickname || info.de} (Kopie)`, createdAt: new Date().toISOString() });
        save(copy);
        location.hash = `#/pokemon/${copy.uuid}`;
        return 'navigated';
      },
      print() {
        window.print();
        return 'navigated';
      },
      delete() {
        const name = pk.nickname ? `„${pk.nickname}“ (${info.de})` : info.de;
        if (!confirm(`${name} wirklich löschen?

Das kann nicht rückgängig gemacht werden. Tipp: vorher „Export“ als Sicherung.`)) return 'navigated';
        deletePokemon(pk.uuid);
        location.hash = '#/';
        return 'navigated';
      },
    };
    if (!actions[act] || actions[act]() === 'navigated') return;
    save(pk);
    draw();
    if (act.startsWith('levelup')) sheet.querySelector('.level-log li')?.classList.add('flash');
  });

  // ---------------------------------------------------------------- Entwickeln-Dialog
  const dlg = root.querySelector('#evo-dlg');
  let evo = null; // { targets: [{ info, cond }], index, abilities, types }

  async function openEvolution() {
    const targets = await Promise.all(info.evo.next.map(async (n) => ({ info: await getSpecies(n.id), cond: n.cond })));
    evo = { targets, index: 0, abilities: 'replace', types: isCustomForm(pk, info) ? 'keep' : 'new' };
    drawEvolution();
    dlg.showModal();
  }

  function drawEvolution() {
    const to = evo.targets[evo.index].info;
    const custom = isCustomForm(pk, info);
    const dice = pk.levelUp.diceOverride || diceClassFor(to, settings).dice;
    const count = evolutionRollCount(pk.level);
    const abName = (a) => esc(abilities[a]?.n || a);
    const preview = (evo.abilities === 'replace' ? mapAbilities(pk.abilities, info, to) : pk.abilities).filter(Boolean);
    dlg.innerHTML = `
      <form method="dialog" class="evo-form">
        <h3>✨ Entwicklung: ${esc(pk.nickname || info.de)} <span class="muted">(${esc(info.de)})</span></h3>
        <div class="evo-targets">
          ${evo.targets.map((t, i) => `
            <label class="evo-opt ${i === evo.index ? 'on' : ''}">
              <input type="radio" name="target" value="${i}" ${i === evo.index ? 'checked' : ''}>
              ${spriteImg(t.info.id, { shiny: pk.shiny, size: 56 })}
              <span><b>${esc(t.info.de)}</b> ${t.info.types.map(typeBadge).join('')}<br>
                <small class="muted">Bedingung im Spiel: ${esc(t.cond)}</small></span>
            </label>`).join('')}
        </div>

        <p><b>Bonus:</b> jeder Statuswert bekommt ${count}× ${esc(dice)}
          <span class="muted">(⌈Lv ${pk.level} / 10⌉ Würfe, Würfelklasse der neuen Art${settings.rerollOnes ? ', 1en werden neu gewürfelt' : ''}, KP ×${settings.hpMultiplier})</span></p>

        <label class="evo-choice">Fähigkeiten
          <select name="abilities">
            <option value="replace" ${evo.abilities === 'replace' ? 'selected' : ''}>durch passende Fähigkeiten von ${esc(to.de)} ersetzen</option>
            <option value="keep" ${evo.abilities === 'keep' ? 'selected' : ''}>unverändert lassen</option>
          </select>
        </label>
        <p class="muted small">Ergebnis: ${preview.map(abName).join(', ') || '–'}</p>

        ${custom ? `
        <label class="evo-choice">Typen
          <select name="types">
            <option value="keep" ${evo.types === 'keep' ? 'selected' : ''}>Custom-Typen behalten</option>
            <option value="new" ${evo.types === 'new' ? 'selected' : ''}>Typen von ${esc(to.de)} übernehmen</option>
          </select>
        </label>
        <p class="muted small">Ergebnis: ${(evo.types === 'keep' ? pk.types : to.types).map(typeBadge).join('')}</p>`
        : `<p class="muted small">Typen: ${to.types.map(typeBadge).join('')}</p>`}

        <p class="muted small">Level, EXP, Statuswerte, Attacken, Spitzname und Freundschaft bleiben erhalten. Die Entwicklung lässt sich über „↶ Rückgängig“ zurücknehmen.</p>
        <div class="row wrap">
          <button value="cancel">Abbrechen</button>
          <button value="ok" class="primary">✨ Zu ${esc(to.de)} entwickeln</button>
        </div>
      </form>`;
  }

  dlg.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (name === 'target') evo.index = +value;
    if (name === 'abilities') evo.abilities = value;
    if (name === 'types') evo.types = value;
    drawEvolution();
  });

  // Formular mit method="dialog": "submit" kommt direkt beim Klick (zuverlässiger als "close")
  dlg.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'ok' || !evo) return;
    evolve(pk, info, evo.targets[evo.index].info, settings, { abilities: evo.abilities, types: evo.types });
    save(pk);
    evo = null;
    render(app, uuid); // neue Art → Bogen mit neuen Artdaten neu aufbauen
  });

  draw();
}

// ---------------------------------------------------------------- Bausteine

/** Eine Kampfwert-Zeile: Name · (Wurf) · Ergebnis · − · + · ↺ · Herleitung */
function battleRow(pk, s) {
  const mods = pk.battle.mods[s];
  const isInit = s === 'initiative';
  const noRoll = isInit && pk.battle.initiative == null;
  const cls = mods > 0 ? 'up' : mods < 0 ? 'down' : '';
  const sign = mods > 0 ? '+' : '−';
  const note = mods ? `${sign}${Math.abs(mods)}×Lv (${sign}${Math.abs(mods) * pk.level})` : '';
  // Spalte "Basis": dauerhafter Wert – bei Kampf-Initiative das Eingabefeld für den Wurf
  const base = isInit
    ? `<input type="number" data-battle-init value="${pk.battle.initiative ?? ''}" placeholder="Wurf" title="Zu Kampfbeginn gewürfelte Initiative eintragen">`
    : `<span class="bt-base">${pk.stats[s]}</span>`;
  return `
    <div class="bt-row">
      <b>${BATTLE_LABELS[s]}</b>
      ${base}
      <span class="bt-val ${cls}">${noRoll ? '–' : battleValue(pk, s)}</span>
      <button data-bmod="${s}" data-step="-1" class="no-print" ${noRoll ? 'disabled' : ''} title="− ${pk.level}">−</button>
      <button data-bmod="${s}" data-step="1" class="no-print" ${noRoll ? 'disabled' : ''} title="+ ${pk.level}">+</button>
      <button data-breset="${s}" class="no-print" ${mods ? '' : 'disabled'} title="Zurücksetzen">↺</button>
      <span class="bt-note">${note}</span>
    </div>`;
}

/** Schwächen & Resistenzen anhand der AKTUELLEN Typen (gilt also auch für Custom-Formen). */
function weaknesses(types) {
  const m = defensiveMatchups(types);
  const groups = [
    [4, '×4'], [2, '×2'], [0.5, '×½'], [0.25, '×¼'], [0, 'immun'],
  ].map(([f, label]) => [label, Object.keys(m).filter((t) => m[t] === f)]).filter(([, list]) => list.length);
  return `
    <div class="matchups">${groups.map(([label, list]) => `
      <div class="mu"><b>${label}</b><span>${list.map(typeBadge).join('')}</span></div>`).join('')}
    </div>
    <p class="muted small">Nur Typen – Effekte von Fähigkeiten (z.B. Schwebe) sind nicht eingerechnet.</p>`;
}

const statOptions = (selected, exclude) =>
  STATS.filter((s) => s !== exclude)
    .map((s) => `<option value="${s}" ${s === selected ? 'selected' : ''}>${STAT_LABELS[s]}</option>`).join('');

/** Lernbare Attacken zuerst (nach Level), danach alle übrigen alphabetisch. */
function moveOptions(moves, info, only) {
  const lv = info.learn.level;
  const other = new Set(info.learn.other);
  const rank = (slug) => (slug in lv ? 0 : other.has(slug) ? 1 : 2);
  return Object.entries(moves)
    .filter(([slug]) => !only || only.has(slug))
    .sort(([a, ma], [b, mb]) => rank(a) - rank(b) || (lv[a] ?? 0) - (lv[b] ?? 0) || ma.n.localeCompare(mb.n))
    .map(([slug, m]) => {
      const hint = slug in lv ? `Lv ${lv[slug]} · ` : other.has(slug) ? 'lernbar · ' : '';
      return `<option value="${esc(m.n)}" label="${esc(hint + m.n)}">`;
    }).join('');
}

function moveRow(slug, i, moves, learnable, canLearn, unlocked) {
  const m = moves[slug];
  const fx = describeMoveEffects(m);
  return `
    <div class="move-row">
      <input list="${unlocked ? 'move-dl' : 'move-dl-species'}" data-move="${i}" value="${esc(m?.n || '')}" placeholder="Attacke ${i + 1}" autocomplete="off">
      ${m ? `
        <div class="move-meta">
          ${typeBadge(m.t)} <span class="badge">${MOVE_CATEGORIES[m.c] || m.c}</span>
          <span>Stärke ${m.p ?? '–'}</span> <span>Genauigkeit ${m.a ?? '–'}</span> <span>AP ${m.pp ?? '–'}</span>
          ${m.pr ? `<span>Priorität ${m.pr > 0 ? '+' : ''}${m.pr}</span>` : ''}
          ${slug in learnable ? `<span class="muted">lernt mit Lv ${learnable[slug]}</span>` : ''}
          ${m.hb ? '<span class="badge">Homebrew</span>' : ''}
          ${canLearn.has(slug) ? '' : '<span class="badge" title="Diese Art kann die Attacke im Spiel nicht lernen">nicht arttypisch</span>'}
        </div>
        <p class="move-text">${esc(m.d)}</p>
        ${fx.length ? `<div class="fx">${fx.map((t) => `<span class="fx-chip">${esc(t)}</span>`).join('')}</div>` : ''}` : ''}
    </div>`;
}

function abilityRow(slug, i, abilities, info, unlocked) {
  const a = abilities[slug];
  const unknown = slug && !a;
  return `
    <div class="ability-row">
      <input list="${unlocked ? 'ability-dl' : 'ability-dl-species'}" data-ability="${i}" value="${esc(a?.n || slug)}" placeholder="Fähigkeit" autocomplete="off">
      ${slug === info.hiddenAbility ? '<span class="badge">versteckt</span>' : ''}
      ${a && !a.hb && !info.abilities.includes(slug) ? '<span class="badge" title="Echte Spiel-Fähigkeit, aber nicht von dieser Art">nicht arttypisch</span>' : ''}
      ${a?.hb ? '<span class="badge">Homebrew</span>' : ''}
      ${unknown ? '<span class="warn">⚠ keine Spiel-Fähigkeit (z.B. aus altem Bogen) – bitte ersetzen</span>' : ''}
      ${a ? `<p class="move-text">${esc(a.d)}</p>` : ''}
    </div>`;
}

/** Ein Protokolleintrag: zeigt jeden einzelnen Würfel, neu gewürfelte 1en durchgestrichen. */
function logEntry(e) {
  const dice = (r) => r.dice.map((d) =>
    `[${d.faces.map((f, k) => (k < d.faces.length - 1 ? `<s title="neu gewürfelt">${f}</s>` : `<b>${f}</b>`)).join('→')}]`).join(' + ');
  if (e.type === 'evolution') {
    const evoRolls = e.rolls.map((r) => `
      <li><b>${STAT_LABELS[r.stat]}</b> ${r.before} → <b>${r.after}</b> <span class="muted">(+${r.gain})</span>
        · ${e.count}× ${esc(e.dice)}: ${r.rolls.map(dice).join(' + ')} = ${r.total}${r.mult !== 1 ? ` ×${r.mult}` : ''}</li>`).join('');
    return `
    <li class="log-evo">
      <div><b>✨ Entwicklung: ${esc(e.fromSpecies)} → ${esc(e.toSpecies)}</b> · Lv ${e.from} · ${e.count}× ${esc(e.dice)} je Wert
        <span class="muted">· ${new Date(e.at).toLocaleString('de-DE')}</span></div>
      <ul>${evoRolls}</ul>
    </li>`;
  }
  // z.B. "Zufall · Sp. Angriff 7 → 10 (+3) · Wurf 1W6: [~1~→3]"
  const rolls = e.rolls.map((r) => `
    <li><span class="badge">${esc(r.kind)}</span> <b>${STAT_LABELS[r.stat]}</b> ${r.before} → <b>${r.after}</b>
      <span class="muted">(+${r.gain})</span> · Wurf ${esc(r.roll.notation)}: ${dice(r.roll)}${r.roll.dice.length > 1 ? ` = ${r.roll.total}` : ''}${r.mult !== 1 ? ` ×${r.mult}` : ''}</li>`).join('');
  return `
    <li>
      <div><b>Lv ${e.from} → ${e.to}</b> · ${esc(e.dice)} · ${e.free ? 'ohne EXP' : `−${e.expUsed} EXP`}
        <span class="muted">· ${new Date(e.at).toLocaleString('de-DE')}</span></div>
      <ul>${rolls}</ul>
    </li>`;
}
