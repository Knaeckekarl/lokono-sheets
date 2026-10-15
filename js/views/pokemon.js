// Pokémon-Bogen in der Optik des Daggerheart-Trainerbogens (nur Design – Inhalte sind Pokémon-Werte).

import { esc, downloadJson, safeName, today, uid, rerenderKeepingFocus } from '../core/util.js';
import {
  STATS, STAT_LABELS, MOVE_CATEGORIES, STATUS_EFFECTS, GENDERS, MAX_TYPES, MAX_ABILITIES, defensiveMatchups,
} from '../core/constants.js';
import { getSpecies, getMoves, getAbilities } from '../core/data.js';
import {
  getPokemon, savePokemon, deletePokemon, listPokemon, listTrainers, getSettings, bundle,
} from '../core/store.js';
import {
  diceClassFor, effectiveDice, expForNextLevel, possibleLevelUps, levelUp, undoLevelUp,
  calcAccuracy, calcEvasion, BATTLE_STATS, battleValue, heal,
  evolve, evolutionRollCount, mapAbilities, pendingBonusPoints, assignBonusPoint,
} from '../core/rules.js';
import { describeMoveEffects } from '../core/effects.js';
import { isCustomForm, allowedGenders, learnableMoves } from '../core/model.js';
import {
  spriteImg, typeBadge, typeOptions, bindFields, dhBanner,
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
    <dialog id="evo-dlg" class="evo-dlg"></dialog>
    <dialog id="pt-dlg" class="evo-dlg"></dialog>`;
  const sheet = root.querySelector('#sheet');
  const save = (m) => savePokemon(m);

  const draw = () => {
    const dc = diceClassFor(info, settings);
    const need = expForNextLevel(pk.level);
    const possible = possibleLevelUps(pk);
    const custom = isCustomForm(pk, info);
    const twin = listPokemon().find((p) => p.uuid !== pk.uuid && p.speciesId === pk.speciesId && p.nickname === pk.nickname);
    const lock = pk.unlocked ? '' : 'disabled title="Gesperrt – „Untypische Änderungen erlauben“ aktivieren"';
    const pending = pendingBonusPoints(pk);
    // Leuchtet, wenn eine Level-Bedingung ("Lv 30") einer möglichen Entwicklung erfüllt ist
    const evoReady = (info.evo?.next || []).some((n) => {
      const m = /Lv (\d+)/.exec(n.cond);
      return m && pk.level >= +m[1];
    });
    const hpPct = pk.stats.hp ? Math.max(0, Math.min(100, (pk.currentHp / pk.stats.hp) * 100)) : 0;

    sheet.style.setProperty('--accent', `var(--t-${pk.types[0] || 'normal'})`);
    sheet.innerHTML = `
      <div class="sheet-toolbar">
        ${pk.trainerId ? `<a class="button" href="#/trainer/${encodeURIComponent(pk.trainerId)}">→ Trainer</a>` : ''}
        <span class="grow"></span>
        <button data-act="export" title="Als JSON-Datei speichern">Export</button>
        <button data-act="duplicate">Duplizieren</button>
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
        ${pk.unlocked ? `
          <label>Typ <select data-f="types.0" data-rerender>${typeOptions(pk.types[0])}</select></label>
          <select data-f="types.1" data-rerender aria-label="Typ 2">${typeOptions(pk.types[1] || '', true)}</select>
          <select data-f="types.2" data-rerender aria-label="Typ 3" title="Dritter Typ – nur als Ausnahme">${typeOptions(pk.types[2] || '', true)}</select>` : ''}
        <span class="pk-types">${pk.types.map(typeBadge).join('')}</span>
        ${custom && pk.unlocked ? `
          <input data-f="formName" value="${esc(pk.formName)}" placeholder="Name der Form">
          <button data-act="reset-types" title="Original: ${info.types.join('/')}">↺ Original-Typen</button>` : ''}
        <label>Geschlecht <select data-f="gender">${Object.entries(GENDERS).map(([k, s]) =>
          `<option value="${k}" ${k === pk.gender ? 'selected' : ''} ${pk.unlocked || genders.includes(k) ? '' : 'disabled'}>${s}</option>`).join('')}</select></label>
        <label><input type="checkbox" data-f="shiny" data-rerender ${pk.shiny ? 'checked' : ''}> Shiny</label>
        <span class="muted small">${info.height / 10} m · ${info.weight / 10} kg · BST ${info.bst}</span>
        <label class="unlock ${pk.unlocked ? 'on' : ''}" title="Erlaubt für DIESES Pokémon: andere Typen, artfremde Fähigkeiten und Attacken, eigene Würfelklasse, jedes Geschlecht">
          <input type="checkbox" data-f="unlocked" data-rerender ${pk.unlocked ? 'checked' : ''}>
          ${pk.unlocked ? '🔓' : '🔒'} Untypische Änderungen erlauben
        </label>
      </div>

      <div class="dh-traits pk-traits">
        <div class="acc-eva">
          <div class="acc-eva-shields">
            <label class="shield"><span class="shield-extra">&nbsp;</span><input type="number" data-f="accuracy" data-t="num" data-rerender value="${pk.accuracy}"><small>ACCURACY</small></label>
            <label class="shield" title="In Klammern: tatsächlicher Abwehrwert (Evasion + 10)"><span class="shield-extra">(${(pk.evasion ?? 0) + 10})</span><input type="number" data-f="evasion" data-t="num" data-rerender value="${pk.evasion}"><small>EVASION</small></label>
          </div>
        </div>
        <div class="pk-traits-main">
          <div class="stat-row">
            ${STATS.map((s) => `
              <label class="trait">
                <span class="banner">${STAT_LABELS[s]}</span>
                <input type="number" min="0" class="trait-val" data-f="stats.${s}" data-t="num" data-rerender value="${pk.stats[s]}">
                <small>Basis ${info.base[s]}</small>
              </label>`).join('')}
          </div>
        </div>
        <div class="lvl-panel">
          <span class="banner">LEVEL &amp; ERFAHRUNG</span>
          <div class="row wrap">
            <label>EXP <input type="number" min="0" data-f="exp" data-t="num" data-rerender value="${pk.exp}"></label>
            <span class="muted">nächstes Level: ${need}</span>
            <label title="${esc(dc.steps.join('\n'))}">Würfel
              <select data-f="levelUp.diceOverride" data-t="nullable" data-rerender ${lock}>
                <option value="">Auto (${dc.dice})</option>
                ${settings.diceLadder.map((d) => `<option ${d === pk.levelUp.diceOverride ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </label>
            <details class="dc-why"><summary>Warum ${dc.dice}?</summary><ul>${dc.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></details>
            <label>Primär <select data-f="levelUp.primary" data-rerender>${statOptions(pk.levelUp.primary)}</select></label>
            <label>Sekundär <select data-f="levelUp.secondary" data-rerender>${statOptions(pk.levelUp.secondary, pk.levelUp.primary)}</select></label>
          </div>
          <div class="row wrap">
            ${possible > 1 ? `
              <select id="lvl-qty" aria-label="Anzahl Levelups">${Array.from({ length: possible }, (_, i) =>
                `<option value="${i + 1}" ${i + 1 === possible ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>` : ''}
            <button data-act="levelup" class="primary" ${possible ? '' : 'disabled'}>⬆ ${possible > 1 ? 'Levelups' : 'Levelup'}</button>
            <button data-act="levelup-free" ${pk.level < 100 ? '' : 'disabled'} title="Level ohne EXP-Kosten, z.B. vom Spielleiter">+1 Level ohne EXP</button>
            <button data-act="undo" ${pk.levelLog.length ? '' : 'disabled'} title="Letztes Levelup bzw. letzte Entwicklung rückgängig machen">↶ Rückgängig</button>
            ${info.evo?.next?.length ? `<button data-act="evolve" class="evo-btn ${evoReady ? 'ready' : ''}"
              title="${evoReady ? 'Level-Bedingung für eine Entwicklung erfüllt' : 'Entwicklung auswählen'}">✨ Entwickeln</button>` : ''}
            ${pending.length ? `<button data-act="points" class="pt-open" title="Ab Lv ${settings.accEvaStart} alle ${settings.accEvaEvery} Level: +1 Accuracy oder Evasion">🎯 ${pending.length} Punkt${pending.length > 1 ? 'e' : ''} für Accuracy/Evasion offen</button>` : ''}
            <span class="muted small">${possible ? `${possible} Levelup${possible > 1 ? 's' : ''} möglich · ` : ''}Würfel ${effectiveDice(pk, info, settings)} · ${settings.rerollOnes ? '1en werden neu gewürfelt' : '1en zählen'} · KP ×${settings.hpMultiplier} · Initiative ×${settings.speedMultiplier}</span>
          </div>
        </div>
      </div>

      <div class="dh-cols">
        <div class="dh-col">
          <section class="dh-sec">
            ${dhBanner('KP &amp; Zustand')}
            <div class="hp-line">
              <b>KP</b>
              <input type="number" min="0" data-f="currentHp" data-t="num" data-rerender value="${pk.currentHp}" aria-label="KP aktuell">
              <span class="muted">/ ${pk.stats.hp}</span>
              <button class="heal-btn" data-act="heal" title="KP auffüllen, Kampfwerte zurücksetzen, Statusprobleme entfernen">❤ Heilen</button>
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
            <div class="row"><button data-act="battle-reset">↺ Alle Kampfwerte zurücksetzen</button></div>
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
            ${pk.abilities.length < MAX_ABILITIES
              ? '<button data-act="add-ability">+ Fähigkeit</button>'
              : `<p class="muted small">Maximal ${MAX_ABILITIES} Fähigkeiten.</p>`}
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
      m.types = [...new Set(m.types.filter(Boolean))].slice(0, MAX_TYPES); // "—" entfernt einen Typ, doppelte fallen weg
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

    // Kampfwerte ±Level / Reset
    if (d.bmod) pk.battle.mods[d.bmod] += +d.step;
    else if (d.breset) pk.battle.mods[d.breset] = 0;
    if (d.bmod || d.breset) {
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
        if (pk.abilities.length < MAX_ABILITIES) pk.abilities.push('');
      },
      points() {
        openPoints();
        return 'navigated';
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
      delete() {
        const name = pk.nickname ? `„${pk.nickname}“ (${info.de})` : info.de;
        if (!confirm(`${name} wirklich löschen?

Das kann nicht rückgängig gemacht werden. Tipp: vorher „Export“ als Sicherung.`)) return 'navigated';
        deletePokemon(pk.uuid);
        location.hash = '#/';
        return 'navigated';
      },
    };
    const pendingBefore = pendingBonusPoints(pk).length;
    if (!actions[act] || actions[act]() === 'navigated') return;
    save(pk);
    draw();
    if (act.startsWith('levelup')) {
      sheet.querySelector('.level-log li')?.classList.add('flash');
      if (pendingBonusPoints(pk).length > pendingBefore) openPoints(); // neuer Punkt → direkt fragen
    }
  });

  // ---------------------------------------------------------------- Accuracy/Evasion-Punkte
  const ptDlg = root.querySelector('#pt-dlg');

  function openPoints() {
    const open = pendingBonusPoints(pk);
    if (!open.length) return;
    ptDlg.innerHTML = `
      <form method="dialog">
        <h3>🎯 Punkt für Accuracy oder Evasion</h3>
        <p class="muted small">Ab Level ${settings.accEvaStart} gibt es alle ${settings.accEvaEvery} Level einen Punkt.
          Erhöhungen durch Story-Ereignisse trägst du einfach direkt im Feld ein.</p>
        ${open.map((e) => `
          <div class="evo-choice pt-row">
            <b>Lv ${e.bonusLevel}</b>
            <label class="chip"><input type="radio" name="pt-${e.bonusLevel}" value="accuracy"> +1 Accuracy <span class="muted">(${pk.accuracy})</span></label>
            <label class="chip"><input type="radio" name="pt-${e.bonusLevel}" value="evasion"> +1 Evasion <span class="muted">(${pk.evasion}, Abwehr ${(pk.evasion ?? 0) + 10})</span></label>
          </div>`).join('')}
        <div class="row wrap">
          <button value="cancel">Später entscheiden</button>
          <button value="ok" class="primary">Übernehmen</button>
        </div>
      </form>`;
    ptDlg.showModal();
  }

  ptDlg.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'ok') return;
    const form = new FormData(e.target);
    for (const entry of pendingBonusPoints(pk)) {
      const stat = form.get(`pt-${entry.bonusLevel}`);
      if (stat) assignBonusPoint(pk, entry, stat); // nicht gewählte bleiben offen
    }
    save(pk);
    draw();
  });

  // ---------------------------------------------------------------- Entwickeln-Dialog
  const dlg = root.querySelector('#evo-dlg');
  // { targets: [{ info, cond }], index, selected: [Fähigkeiten], custom, customTypes, formName, dice }
  let evo = null;

  /** Empfohlene Fähigkeiten: positionsgenau ersetzt, eigene Änderungen bleiben. */
  const recommended = (to) => mapAbilities(pk.abilities, info, to).filter(Boolean).slice(0, MAX_ABILITIES);
  const target = () => evo.targets[evo.index].info;

  async function openEvolution() {
    const targets = await Promise.all(info.evo.next.map(async (n) => ({ info: await getSpecies(n.id), cond: n.cond })));
    // Ist das Pokémon schon eine Custom-Form, startet der Dialog mit deren Typen
    const custom = isCustomForm(pk, info);
    evo = {
      targets, index: 0, selected: recommended(targets[0].info),
      custom, customTypes: custom ? [...pk.types] : [...targets[0].info.types], formName: pk.formName,
      dice: pk.levelUp.diceOverride ?? '',
    };
    drawEvolution();
    dlg.showModal();
  }

  /** Einordnung einer Fähigkeit für die Markierung im Dialog. */
  function abilityStatus(a, to) {
    const now = pk.abilities.includes(a);
    if (!abilities[a]) return ['custom', 'eigene Fähigkeit'];
    if (now && to.abilities.includes(a)) return ['keep', 'bleibt'];
    if (now && info.abilities.includes(a)) return ['lost', 'fällt üblicherweise weg'];
    if (now) return ['custom', 'eigene Änderung'];
    return ['new', 'kommt üblicherweise dazu'];
  }

  /** Untypisch: eine Fähigkeit behalten, die die neue Art nicht hat, oder eine neue feste Würfelklasse wählen. */
  const untypicalChoice = (to) =>
    evo.selected.some((a) => !to.abilities.includes(a) && info.abilities.includes(a))
    || (evo.dice !== '' && evo.dice !== (pk.levelUp.diceOverride ?? ''));

  function drawEvolution() {
    const to = target();
    const auto = diceClassFor(to, settings);
    const usedDice = evo.dice || auto.dice;
    const count = evolutionRollCount(pk.level);
    const abName = (a) => esc(abilities[a]?.n || a);
    // Erst die Fähigkeiten der neuen Art, dann alles, was das Pokémon sonst noch hat
    const candidates = [...new Set([...to.abilities, ...pk.abilities.filter(Boolean)])];
    const willUnlock = !pk.unlocked && (evo.custom || untypicalChoice(to));
    const full = evo.selected.length >= MAX_ABILITIES;
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

        <h4>Würfelklasse</h4>
        <div class="evo-choice">
          <select name="dice">
            <option value="" ${evo.dice === '' ? 'selected' : ''}>Auto: ${esc(auto.dice)} (Würfelklasse von ${esc(to.de)})</option>
            ${settings.diceLadder.map((d) => `<option ${d === evo.dice ? 'selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
          <details class="dc-why"><summary>Warum ${esc(auto.dice)}?</summary><ul>${auto.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
        </div>
        <p class="muted small">Gilt für den Entwicklungsbonus und alle künftigen Levelups${pk.levelUp.diceOverride ? ` · bisher eigene Klasse ${esc(pk.levelUp.diceOverride)}` : ''}.</p>
        <p><b>Bonus:</b> jeder Statuswert bekommt ${count}× ${esc(usedDice)}
          <span class="muted">(⌈Lv ${pk.level} / 10⌉ Würfe${settings.rerollOnes ? ', 1en werden neu gewürfelt' : ''}, KP ×${settings.hpMultiplier})</span></p>

        <h4>Fähigkeiten</h4>
        <div class="evo-choice">
          <button type="button" data-preset="recommended" title="Passende Fähigkeiten der neuen Art, eigene Änderungen bleiben">Empfehlung</button>
          <button type="button" data-preset="keep">Alles behalten</button>
          <button type="button" data-preset="new">Nur ${esc(to.de)}</button>
        </div>
        <p class="muted small">${evo.selected.length} / ${MAX_ABILITIES} gewählt${full ? ' – zum Tauschen erst eine abwählen' : ''}</p>
        <div class="evo-abilities">
          ${candidates.map((a) => {
            const [cls, label] = abilityStatus(a, to);
            return `
            <label class="evo-ab">
              <input type="checkbox" name="ability" value="${esc(a)}" ${evo.selected.includes(a) ? 'checked' : full ? 'disabled' : ''}>
              <span><b>${abName(a)}</b> <span class="ab-tag ${cls}">${label}</span>
                ${a === to.hiddenAbility ? '<span class="badge">versteckt</span>' : ''}
                ${abilities[a] ? `<small class="muted">${esc(abilities[a].d)}</small>` : ''}</span>
            </label>`;
          }).join('')}
        </div>

        <h4>Typen</h4>
        <div class="evo-choice">
          <label class="unlock ${evo.custom ? 'on' : ''}" title="Bei der Entwicklung entsteht eine eigene Form mit frei gewählten Typen">
            <input type="checkbox" name="customForm" ${evo.custom ? 'checked' : ''}> 🔓 Custom-Form
          </label>
        </div>
        ${evo.custom ? `
        <div class="evo-choice">
          ${Array.from({ length: MAX_TYPES }, (_, i) => `
            <select name="type${i}" aria-label="Typ ${i + 1}">${typeOptions(evo.customTypes[i] || '', i > 0)}</select>`).join('')}
          <input name="formName" value="${esc(evo.formName)}" placeholder="Name der Form (optional)">
        </div>
        <p class="muted small">Ergebnis: ${[...new Set(evo.customTypes.filter(Boolean))].map(typeBadge).join('')}</p>`
        : `<p class="muted small">Ergebnis: ${to.types.map(typeBadge).join('')} (Typen von ${esc(to.de)})</p>`}

        ${willUnlock ? '<p class="warn">Diese Auswahl ist untypisch und schaltet „Untypische Änderungen erlauben“ für dieses Pokémon frei.</p>' : ''}
        <p class="muted small">Level, EXP, Statuswerte, Attacken und Spitzname bleiben erhalten. Die Entwicklung lässt sich über „↶ Rückgängig“ zurücknehmen.</p>
        <div class="row wrap">
          <button value="cancel">Abbrechen</button>
          <button value="ok" class="primary">✨ Zu ${esc(to.de)} entwickeln</button>
        </div>
      </form>`;
  }

  dlg.addEventListener('change', (e) => {
    const { name, value, checked } = e.target;
    if (name === 'formName') return; // Textfeld: siehe "input", kein Neuzeichnen (Fokus bleibt)
    if (name === 'target') {
      evo.index = +value;
      evo.selected = recommended(target());
      if (!evo.custom) evo.customTypes = [...target().types];
    }
    if (name === 'dice') evo.dice = value;
    if (name === 'ability') evo.selected = [...dlg.querySelectorAll('input[name="ability"]:checked')].map((x) => x.value);
    if (name === 'customForm') evo.custom = checked;
    if (name?.startsWith('type')) evo.customTypes[+name.slice(4)] = value;
    drawEvolution();
  });
  dlg.addEventListener('input', (e) => {
    if (e.target.name === 'formName') evo.formName = e.target.value;
  });
  // Schnellauswahl Fähigkeiten
  dlg.addEventListener('click', (e) => {
    const preset = e.target.closest('[data-preset]')?.dataset.preset;
    if (!preset) return;
    const to = target();
    evo.selected = (preset === 'recommended' ? recommended(to)
      : preset === 'keep' ? pk.abilities.filter(Boolean)
        : [...to.abilities]).slice(0, MAX_ABILITIES);
    drawEvolution();
  });

  // Formular mit method="dialog": "submit" kommt direkt beim Klick (zuverlässiger als "close")
  dlg.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'ok' || !evo) return;
    const to = target();
    evolve(pk, info, to, settings, {
      abilities: evo.selected,
      customForm: evo.custom ? { types: evo.customTypes, formName: evo.formName.trim() } : null,
      dice: evo.dice || null,
      unlock: untypicalChoice(to),
    });
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
      <button data-bmod="${s}" data-step="-1" ${noRoll ? 'disabled' : ''} title="− ${pk.level}">−</button>
      <button data-bmod="${s}" data-step="1" ${noRoll ? 'disabled' : ''} title="+ ${pk.level}">+</button>
      <button data-breset="${s}" ${mods ? '' : 'disabled'} title="Zurücksetzen">↺</button>
      <span class="bt-note">${note}</span>
    </div>`;
}

/** Schwächen & Resistenzen anhand der AKTUELLEN Typen (gilt also auch für Custom-Formen). */
function weaknesses(types) {
  const m = defensiveMatchups(types);
  const groups = [
    [8, '×8'], [4, '×4'], [2, '×2'], [1, '×1'], [0.5, '×½'], [0.25, '×¼'], [0.125, '×⅛'], [0, 'immun'],
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
