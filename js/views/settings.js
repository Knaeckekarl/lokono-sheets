// Regeln & Würfel: Würfelklassen-Grenzen, Reroll-Regel, Multiplikatoren, Testwurf.

import { esc } from '../core/util.js';
import { DEFAULT_SETTINGS } from '../core/rules.js';
import { roll, formatRoll, parseDice } from '../core/dice.js';
import { getSettings, saveSettings } from '../core/store.js';

export async function render(app) {
  const root = document.createElement('div');
  app.replaceChildren(root);
  let s = structuredClone(getSettings());

  const diceSelect = (name, value) =>
    `<select name="${name}">${s.diceLadder.map((d) => `<option ${d === value ? 'selected' : ''}>${d}</option>`).join('')}</select>`;

  const draw = () => {
    root.innerHTML = `
      <form class="card" id="rules">
        <h2>Regeln &amp; Würfel</h2>
        <p class="muted">Diese Einstellungen gelten in deinem Browser für alle Pokémon. Einzelne Pokémon können ihre Würfelklasse zusätzlich im Bogen überschreiben.</p>

        <h3>Würfelklassen nach BST</h3>
        <table class="table">
          <thead><tr><th>BST bis einschließlich</th><th>Würfelklasse</th><th></th></tr></thead>
          <tbody>
          ${s.bstThresholds.map((t, i) => `
            <tr>
              <td><input type="number" name="max-${i}" value="${t.max ?? ''}" placeholder="unbegrenzt"></td>
              <td>${diceSelect(`dice-${i}`, t.dice)}</td>
              <td><button type="button" data-del="${i}" class="mini">×</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button type="button" data-act="add-row">+ Zeile</button>

        <div class="row wrap">
          <label>Legendär/Mysteriös ${diceSelect('legendaryDice', s.legendaryDice)}</label>
          <label>Maximum für Nicht-Legendäre ${diceSelect('maxNonLegendaryDice', s.maxNonLegendaryDice)}</label>
          <label><input type="checkbox" name="evolutionModifiers" ${s.evolutionModifiers ? 'checked' : ''}> Entwicklungs-Modifikatoren anwenden</label>
        </div>
        <label>Würfelleiter (aufsteigend, kommagetrennt)
          <input name="diceLadder" value="${esc(s.diceLadder.join(', '))}">
        </label>

        <h3>Levelup</h3>
        <div class="row wrap">
          <label><input type="checkbox" name="rerollOnes" ${s.rerollOnes ? 'checked' : ''}> Gewürfelte 1en neu würfeln (pro Würfel, bis keine 1)</label>
          <label>KP-Multiplikator <input type="number" name="hpMultiplier" min="1" value="${s.hpMultiplier}"></label>
          <label>Initiative-Multiplikator <input type="number" name="speedMultiplier" min="1" value="${s.speedMultiplier}"></label>
        </div>
        <div class="row wrap">
          <label>Accuracy/Evasion-Punkt ab Level <input type="number" name="accEvaStart" min="1" value="${s.accEvaStart}"></label>
          <label>dann alle <input type="number" name="accEvaEvery" min="1" value="${s.accEvaEvery}"> Level</label>
        </div>

        <h3>Stats an Level angleichen</h3>
        <div class="row wrap">
          <label>Entwicklungsboni <input type="number" name="levelStatEvoShare" min="0" max="100" step="5"
            value="${Math.round(s.levelStatEvoShare * 100)}"> %</label>
        </div>
        <p class="muted">Ein per Levelup trainiertes Pokémon bekommt bei jeder Entwicklung Bonuswürfe auf alle Statuswerte
          (je angefangene 10 Level ein Wurf der neuen Würfelklasse). Beim Angleichen wird geschätzt, wie viele Statpunkte ein
          trainiertes Pokémon gleichen Levels im Schnitt hätte. Dieser Wert legt fest, wie viel Prozent der Entwicklungswürfe
          dabei mitzählen. Ein Teil des Entwicklungssprungs steckt bereits in den höheren Basiswerten der neuen Art,
          deshalb ist 45 % der Standard. Höhere Werte machen angeglichene Pokémon, die sich schon entwickelt haben, stärker;
          bei 100 % zählen alle Entwicklungswürfe voll. Auf Pokémon ohne durchlaufene Entwicklung wirkt der Wert nicht.</p>

        <div class="row wrap">
          <button class="primary">Speichern</button>
          <button type="button" data-act="reset">Auf Standard zurücksetzen</button>
          <span id="saved" class="muted"></span>
        </div>
      </form>

      <section class="card">
        <h3>Testwurf</h3>
        <div class="row wrap">
          <select id="test-dice">${s.diceLadder.map((d) => `<option>${d}</option>`).join('')}</select>
          <button data-act="test">Würfeln</button>
        </div>
        <pre id="test-out" class="log-box"></pre>
      </section>`;
  };

  // Formular → Einstellungsobjekt (inkl. Validierung der Würfelangaben)
  const readForm = () => {
    const f = new FormData(root.querySelector('#rules'));
    const ladder = f.get('diceLadder').split(',').map((x) => x.trim().toUpperCase().replace('D', 'W')).filter(Boolean);
    ladder.forEach(parseDice); // wirft bei Tippfehlern
    return {
      ...s,
      diceLadder: ladder,
      bstThresholds: s.bstThresholds.map((_, i) => ({
        max: f.get(`max-${i}`) === '' ? null : +f.get(`max-${i}`),
        dice: f.get(`dice-${i}`),
      })),
      legendaryDice: f.get('legendaryDice'),
      maxNonLegendaryDice: f.get('maxNonLegendaryDice'),
      evolutionModifiers: f.has('evolutionModifiers'),
      rerollOnes: f.has('rerollOnes'),
      hpMultiplier: +f.get('hpMultiplier') || 1,
      speedMultiplier: +f.get('speedMultiplier') || 1,
      accEvaStart: Math.max(1, +f.get('accEvaStart') || 10),
      accEvaEvery: Math.max(1, +f.get('accEvaEvery') || 5),
      levelStatEvoShare: Math.min(100, Math.max(0, +f.get('levelStatEvoShare') || 0)) / 100,
    };
  };

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      s = readForm();
      s.bstThresholds.sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
      if (s.bstThresholds.at(-1).max != null) s.bstThresholds.push({ max: null, dice: s.bstThresholds.at(-1).dice });
      saveSettings(s);
      draw();
      root.querySelector('#saved').textContent = '✓ gespeichert';
    } catch (err) {
      alert(err.message);
    }
  });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    // Ungespeicherte Eingaben beim Hinzufügen/Entfernen von Zeilen nicht verlieren
    if (b.dataset.del != null || b.dataset.act === 'add-row') {
      try { s = readForm(); } catch { /* ungültige Würfelleiter: alten Stand behalten */ }
    }
    if (b.dataset.del != null) {
      s.bstThresholds.splice(+b.dataset.del, 1);
      draw();
    } else if (b.dataset.act === 'add-row') {
      s.bstThresholds.splice(-1, 0, { max: 0, dice: s.diceLadder[0] });
      draw();
    } else if (b.dataset.act === 'reset' && confirm('Alle Regeln auf Standard zurücksetzen?')) {
      s = structuredClone(DEFAULT_SETTINGS);
      saveSettings(s);
      draw();
    } else if (b.dataset.act === 'test') {
      const r = roll(root.querySelector('#test-dice').value, { rerollOnes: s.rerollOnes });
      const out = root.querySelector('#test-out');
      out.textContent = `${formatRoll(r)}\n${out.textContent}`.slice(0, 2000);
    }
  });

  draw();
}
