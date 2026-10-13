# Anleitung: Lokono Sheets auf GitHub Pages hosten

Am Ende läuft das Tool unter `https://<dein-github-name>.github.io/<repo-name>/`, genau wie die alte Seite.
Es gibt keinen Server und keine Datenbank. GitHub liefert nur die Dateien aus diesem Ordner aus.

---

## 0. Einmalig vorbereiten

Auf diesem Rechner ist **Git** bereits installiert (`git --version` → 2.47) und **Python** ebenfalls (3.14).
Node.js wird **nicht** benötigt.

Git deinen Namen mitteilen (einmalig, im VS-Code-Terminal mit `Strg+ö`):

```bash
git config --global user.name "Dein Name"
git config --global user.email "deine-github-mail@example.com"
```

---

## 1. Lokal ausprobieren

Die Seite muss über einen kleinen lokalen Webserver laufen. Per Doppelklick auf `index.html` funktionieren die JavaScript-Module nicht.

```bash
cd C:\Projects\Pokemonsheets
python -m http.server 8000
```

Dann im Browser öffnen:

- App: <http://localhost:8000>
- Tests: <http://localhost:8000/tests/> (sollte „… bestanden, 0 fehlgeschlagen“ zeigen)

Server beenden: `Strg+C` im Terminal.
Wenn du Code geändert hast und der Browser noch die alte Version zeigt, hilft `Strg+F5`.

> **Wichtig:** Bögen werden im Browser gespeichert (localStorage), und zwar **pro Adresse**.
> Was du unter `localhost:8000` anlegst, ist später unter `github.io` **nicht** zu sehen.
> Zum Umziehen: in der Übersicht „Komplett-Backup exportieren“ und auf der anderen Seite importieren.

---

## 2. Repository auf GitHub anlegen

1. Auf <https://github.com/new> gehen.
2. **Repository name:** z.B. `lokono-sheets`. Der Name steht später in der URL.
3. **Public** wählen. GitHub Pages ist für private Repos nur mit einem bezahlten Plan verfügbar.
4. **Kein** Häkchen bei „Add a README“, „.gitignore“ oder „license“, denn das Projekt bringt alles mit.
5. **Create repository** klicken.

---

## 3. Projekt hochladen (erster Push)

Im VS-Code-Terminal im Projektordner (`<NAME>` durch deinen GitHub-Namen ersetzen):

```bash
git init
git add .
git commit -m "Erste Version Lokono Sheets"
git branch -M main
git remote add origin https://github.com/<NAME>/lokono-sheets.git
git push -u origin main
```

Beim ersten `push` öffnet sich ein Browserfenster zur GitHub-Anmeldung (Git Credential Manager). Einmal bestätigen, danach merkt sich Git das.

**Nicht** hochgeladen werden (siehe `.gitignore`): `pokelogs/` (deine alten Spielstände), das PDF (Daggerheart-Vorlage, urheberrechtlich geschützt) und `tools/.cache/`.
Der Ordner `data/` (ca. 6 MB) **muss** mit hochgeladen werden, denn darin stecken die Spieldaten.

---

## 4. GitHub Pages einschalten

1. Im Repo auf GitHub: **Settings → Pages**.
2. Bei **Source**: „Deploy from a branch“.
3. **Branch:** `main`, Ordner **`/ (root)`**, dann **Save**.
4. 1–2 Minuten warten. Oben auf der Pages-Seite erscheint der Link
   `https://<NAME>.github.io/lokono-sheets/`.

Den Fortschritt siehst du im Repo unter dem Reiter **Actions** („pages build and deployment“).

---

## 5. Änderungen veröffentlichen

Jede Änderung, die du pushst, ist nach ca. 1 Minute online:

```bash
git add .
git commit -m "Kurz beschreiben, was geändert wurde"
git push
```

Alternativ ohne Terminal: in VS Code links auf **Quellcodeverwaltung** (`Strg+Umschalt+G`) gehen, eine Nachricht eintippen, auf **Commit** und dann auf **Änderungen synchronisieren** klicken.

---

## 6. Homebrew für alle veröffentlichen

Im Tool unter **Homebrew** angelegte Pokémon, Attacken und Fähigkeiten gelten zuerst nur in deinem Browser (Entwurf).
Damit **alle** sie sehen, muss `homebrew/homebrew.json` im Repo landen. Dafür gibt es zwei Wege:

**Variante A: Datei committen (ohne Token)**
1. Im Homebrew-Editor auf „homebrew.json herunterladen“ klicken.
2. Die Datei nach `C:\Projects\Pokemonsheets\homebrew\homebrew.json` kopieren und die alte ersetzen.
3. Committen und pushen (siehe Schritt 5).

**Variante B: direkt aus dem Tool (mit Token)**
1. Auf GitHub: **Settings (dein Profil) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** „Only select repositories“ und nur `lokono-sheets` auswählen.
3. **Permissions → Repository permissions → Contents:** „Read and write“.
4. Ein Ablaufdatum wählen (z.B. 1 Jahr), Token erzeugen und kopieren (`github_pat_…`).
5. Im Tool unter **Homebrew → Veröffentlichen** Folgendes eintragen: Repo `<NAME>/lokono-sheets`, Branch `main` und den Token.
   Der Token wird nur in deinem Browser gespeichert. Gib ihn nicht weiter.
6. Klick auf „Auf GitHub veröffentlichen“. Nach dem Pages-Deploy (~1–2 Min.) sehen es alle.

> Wenn du über Variante B veröffentlichst, liegt danach auf GitHub eine neuere `homebrew.json` als bei dir lokal.
> Hol sie dir vor eigenen Code-Änderungen mit `git pull`, sonst gibt es beim nächsten Push einen Konflikt.

---

## 7. Spieldaten aktualisieren (selten nötig)

Die Dateien in `data/` werden aus der PokéAPI erzeugt. Bei neuen Spielen oder neuen Pokémon:

```bash
python tools/build_data.py --refresh
```

Das dauert beim ersten Mal ca. 5–15 Minuten (rund 4000 Abfragen, die zwischengespeichert werden). Danach committen und pushen.
Ohne `--refresh` wird nur aus dem Cache neu gebaut, das dauert Sekunden.

---

## Probleme?

| Problem | Lösung |
|---|---|
| `https://<NAME>.github.io/lokono-sheets/` zeigt 404 | 2 Minuten warten; unter Settings → Pages prüfen, ob `main` / `root` gewählt ist |
| Seite lädt, aber „Fehler … data/…: HTTP 404“ | Ordner `data/` wurde nicht gepusht → `git add data` + commit + push |
| Nach einem Update ist alles noch alt | `Strg+F5` (Browser-Cache) |
| Meine Bögen sind weg | Daten liegen pro Browser und pro Adresse. Am alten Ort exportieren, am neuen importieren |
| `git push` wird abgelehnt („fetch first“) | Erst `git pull`, dann erneut `git push` |
| Token-Veröffentlichung: „GitHub: 404“ | Repo-Name falsch geschrieben oder Token hat keinen Zugriff auf dieses Repo |
| Token-Veröffentlichung: „GitHub: 403“ | Token hat nicht „Contents: Read and write“ |
