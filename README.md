# Lokono Sheets

Pokémon- und Trainerbögen für die Lokono-Kampagne. Das Tool ist der Nachfolger von
[PokemonTriadsSheetCreator](https://churchmankingzi.github.io/PokemonTriadsSheetCreator/), hat aber angepasste Regeln.
Es ist eine reine statische Webseite (HTML/CSS/JavaScript ohne Build-Schritt) und lässt sich auf GitHub Pages hosten.

➡ **Hosting & Veröffentlichen:** siehe [ANLEITUNG_GITHUB.md](ANLEITUNG_GITHUB.md)
➡ **Lokal starten:** `python -m http.server 8000` → <http://localhost:8000>

## Was das Tool kann

**Pokémon-Bogen** (gleiche Optik wie der Daggerheart-Trainerbogen, aber mit Pokémon-Inhalten)
- Basisdaten, Attacken und Fähigkeiten **ausschließlich aus den Original-Spielen**: deutsche Namen und Spieltexte, Stärke, Genauigkeit, AP und Priorität
- Neue Pokémon starten mit ihren echten Spiel-Fähigkeiten, die versteckte ist markiert
- **Schalter „Untypische Änderungen erlauben“** (pro Pokémon, standardmäßig aus 🔒). Ohne ihn gilt:
  Typen und Würfelklasse sind gesperrt, Attacken nur aus dem Lernset der Art, Fähigkeiten nur die der Art,
  Geschlecht nur wie im Spiel möglich. Mit 🔓 ist alles frei wählbar. Untypische Einträge tragen den Hinweis „nicht arttypisch“
- **Custom-Formen** (bei 🔓): Typen frei änderbar, optional mit Formnamen und Rücksetz-Knopf
- **Schwächen & Resistenzen** anhand der aktuellen Typen (also auch für Custom-Formen)
- **Zusatzeffekte mit Wahrscheinlichkeit** aus den Spieldaten bei jeder Attacke, z.B. „10 %: Einfrieren“, „20 %: Vert. −1 (Ziel)“, „2–5 Treffer“
- **Kampfwerte als Momentaufnahme:** Angriff, Verteidigung, Sp. Angriff, Sp. Verteidigung und Kampf-Initiative (Wurf zu Kampfbeginn eintragen). „+“ und „−“ verändern um je 1× Level. Die Statuswerte selbst bleiben unverändert; Reset pro Wert oder für alle
- **❤ Heilen:** KP voll, Kampfwerte zurückgesetzt, Statusprobleme entfernt
- **Freundschaft** als Kästchen-Leiste wie HP/Stress (Maximum unter „Regeln & Würfel“, Standard 10). Strichlisten aus alten Bögen werden übernommen
- **Spitzname** als Alleinstellungsmerkmal. Intern hat jedes Pokémon eine eindeutige ID, gleiche Art + gleicher Spitzname löst eine Warnung aus. Mit „Duplizieren“ entstehen Varianten
- **Levelup** wie bisher: Pro Level gibt es zwei Würfe der Würfelklasse, einen auf einen zufälligen Wert und einen auf die Primärwahl (Sekundärwahl, falls der Zufall die Primärwahl schon getroffen hat). KP-Zuwachs ×3, Initiative ohne Multiplikator
  - gewürfelte **1en werden neu gewürfelt** (pro Würfel, bis keine 1 mehr fällt)
  - **Levelup-Protokoll** mit jedem einzelnen Würfel; neu gewürfelte 1en sind durchgestrichen sichtbar
  - bei mehreren möglichen Levelups: **Anzahl auswählbar**
  - letztes Levelup exakt rückgängig machbar; „+1 Level ohne EXP“ für Spielleiter-Level
- **✨ Entwickeln:** Ein Dialog zeigt alle möglichen Entwicklungen mit der Bedingung aus dem Spiel
  (z.B. „Lv 30“, „Wasserstein“, „Tausch, trägt King-Stein“; Regionalformen → passende Regionalform).
  Im Dialog wählst du, ob die Fähigkeiten durch die passenden der neuen Art ersetzt werden und ob Custom-Typen bleiben.
  Level, EXP, Werte, Attacken, Spitzname und Freundschaft bleiben. Bonus: jeder Statuswert bekommt ⌈Level/10⌉ Würfe
  der neuen Würfelklasse (KP ×3, 1en neu gewürfelt). Alles steht im Protokoll und ist rückgängig machbar
- Accuracy & Evasion statt GENA & PA. Wunden, Fertigkeiten und Bewegung entfallen

**Trainer-Bogen** im Daggerheart-Stil (wie das PDF)
- Name, Pronouns, Class, Boon, Level, Evasion, Capacity, die 6 Traits
- Damage Thresholds (+Level), HP- und Stress-Leisten, Hope, Experiences, Class Feature
- **Team** mit den eigenen Pokémon (aktiv/inaktiv), Orden, Inventar, Notizen

**Allgemein**
- **Würfelklassen anpassbar** (Seite „Regeln & Würfel“): BST-Grenzen, Würfelleiter, Legendär-Würfel, Reroll-Regel, Multiplikatoren. Pro Pokémon zusätzlich überschreibbar (bei 🔓)
- **Import alter JSON-Dateien** (auch ganze Ordner wie `pokelogs/`). Bei mehreren Ständen desselben Pokémon gewinnt der neueste
- **Homebrew-Editor** für eigene Pokémon, Attacken und Fähigkeiten, veröffentlichbar für alle (siehe Anleitung)
- Export/Import als JSON, Druckansicht (immer hell)
- **Darkmode:** Schalter oben rechts (Auto → Hell → Dunkel); „Auto“ folgt der Systemeinstellung

## Projektaufbau

```
index.html               Einstieg (lädt nur js/main.js + CSS)
css/style.css            Gesamtes Styling inkl. Daggerheart-Trainerbogen und Druckansicht
js/
  main.js                Router (#/, #/pokemon/<id>, #/trainer/<id>, #/settings, #/homebrew)
  core/                  Logik ohne Oberfläche
    rules.js             ★ ALLE Spielregeln: Würfelklassen, Startwerte, Levelup, Kampfwerte, Heilen, Accuracy/Evasion
    effects.js           Zusatzeffekte von Attacken als deutsche Texte
    dice.js              Würfeln inkl. 1er-Reroll und Protokoll
    constants.js         Typen, Typtabelle, Statusnamen, Trainer-Traits
    model.js             Datenmodell Pokémon/Trainer (+ Auffüllen fehlender Felder)
    store.js             Speichern im Browser, Import/Export-Format
    data.js              Laden der Spieldaten + Homebrew-Überlagerung
    migrate.js           Umwandlung alter Exporte (PokemonTriadsSheetCreator)
    util.js              Kleinkram (HTML-Escaping, Download, …)
  views/                 Oberfläche, je Seite eine Datei (werden erst bei Bedarf geladen)
    home.js · pokemon.js · trainer.js · settings.js · homebrew.js · shared.js
data/                    Original-Spieldaten, ERZEUGT von tools/build_data.py, nicht von Hand ändern
  pokedex.json           Suchindex aller 1351 Pokémon/Formen (~70 KB)
  pokemon/<id>.json      Details je Pokémon (Basiswerte, Entwicklung, Lernset, Fähigkeiten)
  moves.json             937 Attacken      abilities.json   314 Fähigkeiten
homebrew/homebrew.json   Eigene Inhalte, gelten für alle Nutzer der Seite
tools/build_data.py      Erzeugt data/ aus der PokéAPI (mit Cache)
tests/index.html         Browser-Tests: http://localhost:8000/tests/
```

### Warum es schnell lädt
- Kein Framework, kein Build: Die Startseite lädt ein paar kleine JS-Module und den 70-KB-Index.
- Die alte Seite fragte zur Laufzeit jede Attacke einzeln bei der PokéAPI ab. Hier ist alles **vorberechnet**: Ein Pokémon-Bogen braucht genau 3 Dateien (Pokémon-Detail, Attacken, Fähigkeiten), und die bleiben danach im Cache.
- Seiten-Module werden erst beim Öffnen der jeweiligen Ansicht geladen, Sprites per `loading="lazy"`.

### Datenformat
Exporte haben die Form `{ "format": "lokono-sheets", "version": 1, "trainers": [...], "pokemon": [...] }`.
Die Felder stehen kommentiert in [js/core/model.js](js/core/model.js). Neue Felder dort in den Defaults ergänzen,
dann bleiben alte Speicherstände automatisch ladbar.

## Wie du weitermachst

**Regel ändern** → nur [js/core/rules.js](js/core/rules.js) anfassen und danach `tests/` im Browser prüfen.

**Offene Punkte**
1. **Accuracy/Evasion-Formel fehlt noch.** Momentan Startwert 5, manuell änderbar.
   Formel in `calcAccuracy()` / `calcEvasion()` in `rules.js` eintragen; der Knopf „↻ berechnen“ im Bogen nutzt sie.
2. Für 106 Attacken und 47 Fähigkeiten (v.a. Gen. 9) hat die PokéAPI keinen deutschen Spieltext. Dort steht der englische Originaltext, markiert mit `[EN]`.
3. Statuswerte bleiben auch im gesperrten Zustand von Hand korrigierbar. Sie sind individuell und nicht arttypisch.
4. Fähigkeiten aus alten Bögen, die nicht zur Art passen (z.B. Haipirinha mit Wassertempo), bleiben erhalten und sind mit „nicht arttypisch“ markiert.

**Ideen für später**
- Entwicklungen für Homebrew-Pokémon im Homebrew-Editor festlegen
- Fähigkeiten-Effekte in der Schwächenübersicht (Schwebe, Sumpfschale …)
- Team-Reihenfolge per Drag & Drop, Trainerbild
- Offline-Nutzung (Service Worker), Dunkelmodus

## Herkunft der Daten
Spieldaten: [PokéAPI](https://pokeapi.co). Sprites: [PokeAPI/sprites](https://github.com/PokeAPI/sprites).
Pokémon © Nintendo/Game Freak/The Pokémon Company; Trainerbogen-Layout nach Daggerheart © Darrington Press.
Nicht-kommerzielles Fanprojekt.
