// Homebrew-Editor: eigene Attacken, Fähigkeiten und Pokémon.
//
// Ablauf:
//  1. Änderungen landen als lokaler Entwurf im Browser → sofort bei DIR aktiv.
//  2. "Veröffentlichen" schreibt homebrew/homebrew.json ins GitHub-Repo
//     (direkt per API-Token oder per Download + Commit) → nach dem nächsten
//     GitHub-Pages-Deploy (~1 Min.) für ALLE aktiv.

import { esc, downloadJson } from '../core/util.js';
import { MOVE_CATEGORIES, STATS, STAT_LABELS, MAX_ABILITIES } from '../core/constants.js';
import {
  getHomebrew, getPublishedHomebrew, getDraft, setDraft, getMoves, getAbilities, HOMEBREW_ID_START,
} from '../core/data.js';
import { typeOptions, typeBadge, invalidateDex } from './shared.js';

const GH_KEY = 'lokono-github';

const slugify = (name) => 'hb-' + name.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

export async function render(app) {
  const root = document.createElement('div');
  app.replaceChildren(root);
  let hb = structuredClone(await getHomebrew());
  let gh = {};
  try { gh = JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch { /* leer */ }

  // Spiel-Daten ohne Homebrew → für Namenskonflikte und Auswahl
  const [allMoves, allAbilities] = await Promise.all([getMoves(), getAbilities()]);
  const gameMoveNames = new Set(Object.values(allMoves).filter((m) => !m.hb).map((m) => m.n.toLowerCase()));
  const gameAbilityNames = new Set(Object.values(allAbilities).filter((a) => !a.hb).map((a) => a.n.toLowerCase()));
  const nameToMove = () => new Map(Object.entries({ ...allMoves, ...hb.moves }).map(([k, m]) => [m.n.toLowerCase(), k]));
  const nameToAbility = () => new Map(Object.entries({ ...allAbilities, ...hb.abilities }).map(([k, a]) => [a.n.toLowerCase(), k]));

  const commit = () => {
    setDraft(hb);
    invalidateDex();
    draw();
  };

  const draw = () => {
    const isDraft = !!getDraft();
    root.innerHTML = `
      <datalist id="hb-moves">${Object.values({ ...allMoves, ...hb.moves }).map((m) => `<option value="${esc(m.n)}">`).join('')}</datalist>
      <datalist id="hb-abilities">${Object.values({ ...allAbilities, ...hb.abilities }).map((a) => `<option value="${esc(a.n)}">`).join('')}</datalist>

      <section class="card">
        <h2>Homebrew</h2>
        <p class="muted">Eigene Inhalte ergänzen die Original-Spieldaten und sind überall als <span class="badge">Homebrew</span> markiert.</p>
        <p>${isDraft
          ? '🟡 <b>Lokaler Entwurf aktiv</b> – nur in diesem Browser sichtbar, bis du veröffentlichst.'
          : '🟢 Entspricht dem veröffentlichten Stand.'}</p>
      </section>

      <section class="card">
        <h3>Attacken (${Object.keys(hb.moves).length})</h3>
        <ul class="hb-list">${Object.entries(hb.moves).map(([k, m]) => `
          <li>${typeBadge(m.t)} <b>${esc(m.n)}</b> <span class="muted">${MOVE_CATEGORIES[m.c]} · Stärke ${m.p ?? '–'} · Gen. ${m.a ?? '–'} · AP ${m.pp}</span>
            <button class="mini" data-edit-move="${esc(k)}">bearbeiten</button><button class="mini danger" data-del-move="${esc(k)}">×</button></li>`).join('')}</ul>
        <form id="f-move" class="hb-form">
          <input type="hidden" name="slug">
          <input name="n" placeholder="Name" required>
          <label>Typ <select name="t">${typeOptions('normal')}</select></label>
          <label>Kategorie <select name="c">${Object.entries(MOVE_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label>Stärke <input type="number" name="p" min="0"></label>
          <label>Genauigkeit <input type="number" name="a" min="0" max="100"></label>
          <label>AP <input type="number" name="pp" min="1" value="10" required></label>
          <label>Priorität <input type="number" name="pr" value="0"></label>
          <textarea name="d" rows="2" placeholder="Beschreibung"></textarea>
          <button class="primary">Attacke speichern</button>
        </form>
      </section>

      <section class="card">
        <h3>Fähigkeiten (${Object.keys(hb.abilities).length})</h3>
        <ul class="hb-list">${Object.entries(hb.abilities).map(([k, a]) => `
          <li><b>${esc(a.n)}</b> <span class="muted">${esc(a.d)}</span>
            <button class="mini" data-edit-ability="${esc(k)}">bearbeiten</button><button class="mini danger" data-del-ability="${esc(k)}">×</button></li>`).join('')}</ul>
        <form id="f-ability" class="hb-form">
          <input type="hidden" name="slug">
          <input name="n" placeholder="Name" required>
          <textarea name="d" rows="2" placeholder="Beschreibung"></textarea>
          <button class="primary">Fähigkeit speichern</button>
        </form>
      </section>

      <section class="card">
        <h3>Pokémon (${hb.pokemon.length})</h3>
        <ul class="hb-list">${hb.pokemon.map((p) => `
          <li>#${p.id} <b>${esc(p.de)}</b> ${p.types.map(typeBadge).join('')}
            <button class="mini" data-edit-pk="${p.id}">bearbeiten</button><button class="mini danger" data-del-pk="${p.id}">×</button></li>`).join('')}</ul>
        <form id="f-pk" class="hb-form">
          <input type="hidden" name="id">
          <input name="de" placeholder="Name" required>
          <label>Typ 1 <select name="t1">${typeOptions('normal')}</select></label>
          <label>Typ 2 <select name="t2">${typeOptions('', true)}</select></label>
          ${STATS.map((s) => `<label>${STAT_LABELS[s]} <input type="number" name="b-${s}" min="1" value="50" required></label>`).join('')}
          <label>Entwicklungsstufe <input type="number" name="stage" min="0" max="2" value="0" title="0 = Basis, 1 = einmal entwickelt, 2 = zweimal"></label>
          <label>Weitere Entwicklungen <input type="number" name="remaining" min="0" max="2" value="0"></label>
          <label><input type="checkbox" name="legendary"> Legendär</label>
          <input name="abilities" placeholder="Fähigkeiten, kommagetrennt (Namen)" list="hb-abilities">
          <input name="hidden" placeholder="Versteckte Fähigkeit (optional)" list="hb-abilities">
          <textarea name="learn" rows="3" placeholder="Lernbare Attacken, je Zeile: &quot;5 Glut&quot; (Level + Name) oder nur &quot;Glut&quot;"></textarea>
          <input name="sprite" type="url" placeholder="Bild-URL (optional, z.B. homebrew/sprites/xyz.png)">
          <button class="primary">Pokémon speichern</button>
        </form>
      </section>

      <section class="card">
        <h3>Veröffentlichen (für alle)</h3>
        <div class="row wrap">
          <button data-act="download">homebrew.json herunterladen</button>
          ${isDraft ? '<button data-act="discard" class="danger">Lokalen Entwurf verwerfen</button>' : ''}
        </div>
        <p class="muted small">Variante A: Datei herunterladen, nach <code>homebrew/homebrew.json</code> im Projekt kopieren, committen &amp; pushen.</p>
        <form id="f-gh" class="hb-form">
          <p class="muted small">Variante B: Direkt ins Repo schreiben. Benötigt einen <b>Fine-grained Personal Access Token</b> nur für dieses Repo mit „Contents: Read and write“. Der Token wird nur in diesem Browser gespeichert.</p>
          <input name="repo" placeholder="nutzer/repo" value="${esc(gh.repo || '')}" required>
          <input name="branch" placeholder="Branch" value="${esc(gh.branch || 'main')}" required>
          <input name="token" type="password" placeholder="github_pat_…" value="${esc(gh.token || '')}" required autocomplete="off">
          <button class="primary">Auf GitHub veröffentlichen</button>
          <span id="gh-status" class="muted"></span>
        </form>
      </section>`;
  };

  const fill = (form, values) => {
    for (const [k, v] of Object.entries(values)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v ?? '';
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  root.addEventListener('click', (e) => {
    const d = e.target.closest('button')?.dataset;
    if (!d) return;
    if (d.editMove) fill(root.querySelector('#f-move'), { slug: d.editMove, ...hb.moves[d.editMove] });
    if (d.editAbility) fill(root.querySelector('#f-ability'), { slug: d.editAbility, ...hb.abilities[d.editAbility] });
    if (d.editPk) {
      const p = hb.pokemon.find((x) => x.id === +d.editPk);
      const moveName = (slug) => allMoves[slug]?.n || hb.moves[slug]?.n || slug;
      const abName = (slug) => allAbilities[slug]?.n || hb.abilities[slug]?.n || slug;
      fill(root.querySelector('#f-pk'), {
        id: p.id, de: p.de, t1: p.types[0], t2: p.types[1] || '', stage: p.evo?.stage, remaining: p.evo?.remaining,
        legendary: p.legendary, sprite: p.sprite,
        ...Object.fromEntries(STATS.map((s) => [`b-${s}`, p.base[s]])),
        abilities: p.abilities.map(abName).join(', '),
        hidden: p.hiddenAbility ? abName(p.hiddenAbility) : '',
        learn: [...Object.entries(p.learn.level).map(([m, l]) => `${l} ${moveName(m)}`), ...p.learn.other.map(moveName)].join('\n'),
      });
    }
    if (d.delMove && confirm('Attacke löschen?')) { delete hb.moves[d.delMove]; commit(); }
    if (d.delAbility && confirm('Fähigkeit löschen?')) { delete hb.abilities[d.delAbility]; commit(); }
    if (d.delPk && confirm('Pokémon löschen? Bögen dieses Pokémon funktionieren dann nicht mehr.')) {
      hb.pokemon = hb.pokemon.filter((p) => p.id !== +d.delPk);
      commit();
    }
    if (d.act === 'download') downloadJson('homebrew.json', hb);
    if (d.act === 'discard' && confirm('Entwurf verwerfen und veröffentlichten Stand laden?')) {
      setDraft(null);
      invalidateDex();
      getPublishedHomebrew().then((p) => { hb = structuredClone(p); draw(); });
    }
  });

  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = Object.fromEntries(new FormData(form));
    const num = (v) => (v === '' || v == null ? null : +v);
    try {
      if (form.id === 'f-move') {
        if (gameMoveNames.has(f.n.toLowerCase())) throw new Error(`„${f.n}“ gibt es bereits als Spiel-Attacke.`);
        hb.moves[f.slug || slugify(f.n)] = { n: f.n.trim(), t: f.t, c: f.c, p: num(f.p), a: num(f.a), pp: num(f.pp), pr: num(f.pr) || 0, d: f.d.trim() };
      } else if (form.id === 'f-ability') {
        if (gameAbilityNames.has(f.n.toLowerCase())) throw new Error(`„${f.n}“ gibt es bereits als Spiel-Fähigkeit.`);
        hb.abilities[f.slug || slugify(f.n)] = { n: f.n.trim(), d: f.d.trim() };
      } else if (form.id === 'f-pk') {
        hb.pokemon = hb.pokemon.filter((p) => p.id !== +f.id);
        hb.pokemon.push(buildPokemon(f, hb, nameToMove(), nameToAbility()));
      } else if (form.id === 'f-gh') {
        gh = { repo: f.repo.trim(), branch: f.branch.trim(), token: f.token.trim() };
        localStorage.setItem(GH_KEY, JSON.stringify(gh));
        const status = root.querySelector('#gh-status');
        status.textContent = 'Veröffentliche …';
        await publishToGitHub(gh, hb);
        status.textContent = '✓ Veröffentlicht – nach dem Pages-Deploy (~1–2 Min.) für alle sichtbar.';
        return;
      }
      commit();
    } catch (err) {
      alert(err.message);
      const status = root.querySelector('#gh-status');
      if (status) status.textContent = '';
    }
  });

  draw();
}

function buildPokemon(f, hb, nameToMove, nameToAbility) {
  const ability = (name) => {
    const slug = nameToAbility.get(name.trim().toLowerCase());
    if (!slug) throw new Error(`Fähigkeit „${name.trim()}“ unbekannt – erst als Homebrew-Fähigkeit anlegen.`);
    return slug;
  };
  const learn = { level: {}, other: [] };
  for (const line of f.learn.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = /^(\d+)\s+(.+)$/.exec(line);
    const slug = nameToMove.get((m ? m[2] : line).toLowerCase());
    if (!slug) throw new Error(`Attacke „${m ? m[2] : line}“ unbekannt.`);
    if (m) learn.level[slug] = +m[1];
    else learn.other.push(slug);
  }
  const abilities = f.abilities.split(',').filter((x) => x.trim()).map(ability);
  const hidden = f.hidden.trim() ? ability(f.hidden) : null;
  if (hidden && !abilities.includes(hidden)) abilities.push(hidden);
  if (abilities.length > MAX_ABILITIES) throw new Error(`Ein Pokémon hat höchstens ${MAX_ABILITIES} Fähigkeiten (inkl. versteckter).`);
  return {
    id: +f.id || Math.max(HOMEBREW_ID_START - 1, ...hb.pokemon.map((p) => p.id)) + 1,
    de: f.de.trim(),
    types: [f.t1, f.t2].filter(Boolean),
    base: Object.fromEntries(STATS.map((s) => [s, +f[`b-${s}`]])),
    legendary: f.legendary === 'on',
    evo: { stage: +f.stage || 0, remaining: +f.remaining || 0, firstLevel: 0, secondLevel: 0, pre: null },
    abilities,
    hiddenAbility: hidden,
    learn,
    sprite: f.sprite.trim(),
  };
}

/** Schreibt homebrew/homebrew.json über die GitHub-Contents-API. */
async function publishToGitHub({ repo, branch, token }, hb) {
  const url = `https://api.github.com/repos/${repo}/contents/homebrew/homebrew.json`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const current = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  const sha = current.ok ? (await current.json()).sha : undefined;
  const bytes = new TextEncoder().encode(JSON.stringify(hb, null, 2) + '\n');
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message: 'Homebrew aktualisiert (über Editor)', content: btoa(bin), branch, sha }),
  });
  if (!res.ok) throw new Error(`GitHub: ${res.status} ${(await res.json().catch(() => ({}))).message || ''}`);
}
