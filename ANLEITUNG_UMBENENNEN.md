# Anleitung: GitHub-Namen / Domain ändern

Die Seite liegt unter `https://<benutzername>.github.io/<reponame>/`.
Den Teil **vor** `.github.io` bestimmt dein **Benutzername**, den Teil **dahinter** der **Repo-Name**.

> Wichtig: Für Pages-Adressen gibt es **keine Weiterleitung**. Die alte Adresse ist danach tot.
> Bögen werden pro Adresse im Browser gespeichert. Wer schon Bögen hat, muss vorher
> „Komplett-Backup exportieren“ und sie auf der neuen Adresse importieren.

---

## 1. Auf GitHub umbenennen

- **Benutzername:** GitHub → Settings → **Account** → **Change username**
- **Repo-Name** (optional): Repo → Settings → **General** → „Repository name“ → **Rename**

Der **Anzeigename** auf deinem Profil (Settings → Public profile → Name) hat mit der Adresse nichts zu tun. Den kannst du jederzeit frei ändern.

## 2. Projektordner umstellen

Im VS-Code-Terminal im Projektordner. `<neuername>` und `<reponame>` ersetzen, die Zahl bleibt gleich:

```bash
git remote set-url origin https://<neuername>@github.com/<neuername>/<reponame>.git
git config credential.username <neuername>
git credential-manager github login
git config --global user.email "190368540+<neuername>@users.noreply.github.com"
```

- Zeile 1: Adresse des Repos
- Zeile 2: Anmeldename für diesen Ordner
- Zeile 3: einmal neu im Browser anmelden
- Zeile 4: neue noreply-Adresse (steht unter GitHub → Settings → **Emails**)

## 3. Prüfen

```bash
git push
```

Erwartet wird kein Fehler („Everything up-to-date“ ist in Ordnung).

Nach 1–2 Minuten ist die Seite unter `https://<neuername>.github.io/<reponame>/` erreichbar.
Falls nicht: Repo → Settings → **Pages** → einmal **Save** klicken, das startet einen neuen Build.

## 4. Nacharbeiten

- **Homebrew im Tool:** unter „Homebrew → Veröffentlichen“ im Feld „Repo“ den neuen Namen eintragen.
- **Lesezeichen/Links** auf die neue Adresse ändern.
