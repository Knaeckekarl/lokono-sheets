"""
Erzeugt die statischen Spieldaten unter data/ aus der PokéAPI.

Warum: Die App soll schnell laden. Statt zur Laufzeit hunderte API-Requests
abzusetzen (wie die alte Seite), werden alle Daten EINMAL hier vorberechnet
und als kompakte JSON-Dateien mit der Seite ausgeliefert.

Aufruf (aus dem Projektordner):
    python tools/build_data.py            # nutzt Cache in tools/.cache
    python tools/build_data.py --refresh  # Cache ignorieren, alles neu laden

Erster Lauf: ca. 4000 Requests, je nach Verbindung 5-15 Minuten.
Folgende Läufe kommen aus dem Cache und dauern Sekunden.
"""

import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "https://pokeapi.co/api/v2"

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
OUT = ROOT / "data"
REFRESH = "--refresh" in sys.argv
THREADS = 12


# ---------------------------------------------------------------- HTTP + Cache

def cache_path(url: str) -> Path:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", url.replace("https://", ""))
    return CACHE / f"{key}.json"


def fetch_text(url: str) -> str:
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "lokono-sheet-builder/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception as e:  # noqa: BLE001 - Netzwerkfehler sollen nur Retry auslösen
            if attempt == 4:
                raise RuntimeError(f"Fehler bei {url}: {e}") from e
            time.sleep(1.5 * (attempt + 1))
    raise AssertionError("unreachable")


def get(url: str):
    """JSON holen, mit Dateicache."""
    p = cache_path(url)
    if p.exists() and not REFRESH:
        return json.loads(p.read_text(encoding="utf-8"))
    text = fetch_text(url)
    p.write_text(text, encoding="utf-8")
    return json.loads(text)


def get_many(urls, label):
    urls = list(dict.fromkeys(urls))
    results = {}
    done = 0
    with ThreadPoolExecutor(THREADS) as pool:
        for url, data in zip(urls, pool.map(get, urls)):
            results[url] = data
            done += 1
            if done % 100 == 0 or done == len(urls):
                print(f"  {label}: {done}/{len(urls)}", flush=True)
    return results


def id_from_url(url: str) -> int:
    return int(url.rstrip("/").split("/")[-1])


# ---------------------------------------------------------------- Text-Helfer

def clean(text: str) -> str:
    text = text.replace("\xad", "").replace("­", "")
    text = text.replace("-\n", "").replace("\n", " ").replace("\f", " ")
    return re.sub(r"\s+", " ", text).strip()


def name_in(names, lang="de"):
    for n in names:
        if n["language"]["name"] == lang:
            return n["name"]
    return None


def latest_flavor(entries, lang):
    """Letzter (= neuester) Spieltext in der gewünschten Sprache."""
    found = [e for e in entries if e["language"]["name"] == lang]
    return clean(found[-1]["flavor_text"]) if found else None


def game_text(obj):
    """Original-Spieltext: Deutsch bevorzugt, sonst Englisch markiert."""
    de = latest_flavor(obj.get("flavor_text_entries", []), "de")
    if de:
        return de
    en = latest_flavor(obj.get("flavor_text_entries", []), "en")
    if en:
        return "[EN] " + en
    for e in obj.get("effect_entries", []):
        if e["language"]["name"] == "en":
            return "[EN] " + clean(e.get("short_effect") or e.get("effect", ""))
    return ""


# ---------------------------------------------------------------- Attacken-Effekte

BAD_POISON = {"toxic", "poison-fang", "malignant-chain"}


def move_effects(m):
    """
    Zusatzeffekte mit Wahrscheinlichkeiten aus den Spieldaten (meta), kompakt:
      ail: [status, chance]   fl: chance (Zurückschrecken)
      st: [[[stat, stufen], ...], chance, "user"|"target"]
      hits: [min, max]   drain: % (negativ = Rückstoß)   heal: %   crit: Stufe
    chance 0 bedeutet "immer" (z.B. bei Status-Attacken).
    """
    meta = m.get("meta")
    if not meta:  # ohne meta (z.B. Tera-Ausbruch) sind Angaben bedingt → weglassen
        return None
    fx = {}
    category = (meta.get("category") or {}).get("name", "")
    ailment = (meta.get("ailment") or {}).get("name", "none")
    if ailment not in ("none", "unknown"):
        # PokéAPI kennt keine "schwere Vergiftung" als eigenen Status
        if ailment == "poison" and m["name"] in BAD_POISON:
            ailment = "bad-poison"
        fx["ail"] = [ailment, meta.get("ailment_chance") or 0]
    if meta.get("flinch_chance"):
        fx["fl"] = meta["flinch_chance"]
    changes = [[c["stat"]["name"], c["change"]] for c in m.get("stat_changes", [])]
    if changes:
        if category == "damage-raise":
            who = "user"
        elif category in ("damage-lower", "swagger"):
            who = "target"
        else:
            who = "user" if changes[0][1] > 0 else "target"
        fx["st"] = [changes, meta.get("stat_chance") or 0, who]
    if meta.get("min_hits"):
        fx["hits"] = [meta["min_hits"], meta["max_hits"]]
    if meta.get("drain"):
        fx["drain"] = meta["drain"]
    if meta.get("healing"):
        fx["heal"] = meta["healing"]
    if meta.get("crit_rate"):
        fx["crit"] = meta["crit_rate"]
    return fx or None


# ---------------------------------------------------------------- Entwicklungen

def walk_chain(chain):
    """
    Liefert pro Spezies-Name: stage, remaining, firstLevel, secondLevel, parent.
    Bedeutung wie in der alten Würfelklassen-Logik.
    """
    info = {}

    def depth_below(node):
        if not node["evolves_to"]:
            return 0
        return 1 + max(depth_below(c) for c in node["evolves_to"])

    def visit(node, stage, levels, parent):
        details = node.get("evolution_details") or []
        own_level = (details[0].get("min_level") or 0) if details else 0
        levels = levels + [own_level] if stage > 0 else levels
        info[node["species"]["name"]] = {
            "stage": stage,
            "remaining": depth_below(node),
            "firstLevel": levels[0] if len(levels) > 0 else 0,
            "secondLevel": levels[1] if len(levels) > 1 else 0,
            "parent": parent,
        }
        for child in node["evolves_to"]:
            visit(child, stage + 1, levels, node["species"]["name"])

    visit(chain, 0, [], None)
    return info


# ---------------------------------------------------------------- Main

STAT_KEYS = {
    "hp": "hp", "attack": "attack", "defense": "defense",
    "special-attack": "spAttack", "special-defense": "spDefense", "speed": "speed",
}


def main():
    CACHE.mkdir(exist_ok=True)
    (OUT / "pokemon").mkdir(parents=True, exist_ok=True)

    print("1/6 Listen laden ...")
    pokemon_list = get(f"{API}/pokemon?limit=3000")["results"]
    species_list = get(f"{API}/pokemon-species?limit=3000")["results"]
    move_list = get(f"{API}/move?limit=3000")["results"]
    ability_list = get(f"{API}/ability?limit=3000")["results"]

    print("2/6 Pokémon & Spezies ...")
    pokemon = get_many([p["url"] for p in pokemon_list], "Pokémon")
    species = get_many([s["url"] for s in species_list], "Spezies")
    species_by_name = {s["name"]: s for s in species.values()}

    print("3/6 Entwicklungsketten ...")
    chains = get_many([s["evolution_chain"]["url"] for s in species.values() if s.get("evolution_chain")], "Ketten")
    evo = {}
    for c in chains.values():
        evo.update(walk_chain(c["chain"]))

    print("4/6 Attacken ...")
    moves_raw = get_many([m["url"] for m in move_list], "Attacken")
    moves = {}
    for m in moves_raw.values():
        moves[m["name"]] = {
            "n": name_in(m["names"]) or name_in(m["names"], "en") or m["name"],
            "t": m["type"]["name"],
            "c": m["damage_class"]["name"] if m.get("damage_class") else "status",
            "p": m.get("power"),
            "a": m.get("accuracy"),
            "pp": m.get("pp"),
            "pr": m.get("priority", 0),
            "d": game_text(m),
        }
        fx = move_effects(m)
        if fx:
            moves[m["name"]]["fx"] = fx

    print("5/6 Fähigkeiten ...")
    abilities_raw = get_many([a["url"] for a in ability_list], "Fähigkeiten")
    abilities = {}
    for a in abilities_raw.values():
        if not a.get("is_main_series", True):
            continue
        abilities[a["name"]] = {
            "n": name_in(a["names"]) or name_in(a["names"], "en") or a["name"],
            "d": game_text(a),
        }

    print("6/6 Dateien schreiben ...")

    def base_stats(p):
        return {STAT_KEYS[s["stat"]["name"]]: s["base_stat"] for s in p["stats"]}

    default_pokemon_of_species = {}
    for p in pokemon.values():
        if p["is_default"]:
            default_pokemon_of_species[p["species"]["name"]] = p

    def evo_info(species_name):
        e = evo.get(species_name)
        if not e:
            return {"stage": 0, "remaining": 0, "firstLevel": 0, "secondLevel": 0}
        return {k: e[k] for k in ("stage", "remaining", "firstLevel", "secondLevel")}

    index = []
    for p in sorted(pokemon.values(), key=lambda x: x["id"]):
        sp = species_by_name.get(p["species"]["name"])
        if not sp:
            continue
        sp_de = name_in(sp["names"]) or sp["name"]
        base = base_stats(p)
        bst = sum(base.values())

        # Formen (ID > 10000) bekommen einen Zusatz, z.B. "Vulpix (alola)"
        de = sp_de
        if not p["is_default"]:
            suffix = p["name"].replace(sp["name"], "").strip("-")
            de = f"{sp_de} ({suffix})" if suffix else sp_de

        e = evo.get(sp["name"], {})
        pre = None
        if e.get("parent"):
            pre_sp = species_by_name.get(e["parent"])
            pre_p = default_pokemon_of_species.get(e["parent"])
            if pre_sp and pre_p:
                pre = {
                    "bst": sum(base_stats(pre_p).values()),
                    "legendary": pre_sp["is_legendary"],
                    "mythical": pre_sp["is_mythical"],
                    **evo_info(e["parent"]),
                }

        # Lernset: Level-Attacken aus der neuesten Edition, alles andere als Liste
        level_moves, newest_vg = {}, -1
        for mv in p["moves"]:
            for d in mv["version_group_details"]:
                if d["move_learn_method"]["name"] == "level-up":
                    newest_vg = max(newest_vg, id_from_url(d["version_group"]["url"]))
        other = []
        for mv in p["moves"]:
            slug = mv["move"]["name"]
            lvl = None
            for d in mv["version_group_details"]:
                if d["move_learn_method"]["name"] == "level-up" and id_from_url(d["version_group"]["url"]) == newest_vg:
                    lvl = d["level_learned_at"]
            if lvl is not None:
                level_moves[slug] = lvl
            else:
                other.append(slug)

        # Nur echte Spiel-Fähigkeiten; die versteckte Fähigkeit wird separat markiert
        game_abilities = [a["ability"]["name"] for a in sorted(p["abilities"], key=lambda a: a["slot"])]
        hidden = next((a["ability"]["name"] for a in p["abilities"] if a["is_hidden"]), None)

        entry = {
            "id": p["id"],
            "speciesId": sp["id"],
            "de": de,
            "en": p["name"],
            "types": [t["type"]["name"] for t in sorted(p["types"], key=lambda t: t["slot"])],
            "base": base,
            "bst": bst,
            "height": p["height"],   # Dezimeter
            "weight": p["weight"],   # Hektogramm
            "legendary": sp["is_legendary"],
            "mythical": sp["is_mythical"],
            "genderRate": sp["gender_rate"],
            "evo": {**evo_info(sp["name"]), "pre": pre},
            "abilities": game_abilities,
            "hiddenAbility": hidden,
            "learn": {"level": level_moves, "other": sorted(other)},
        }
        (OUT / "pokemon" / f"{p['id']}.json").write_text(
            json.dumps(entry, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        # Index-Zeile: [id, deutsch, englisch, typen, bst]
        index.append([p["id"], de, p["name"], entry["types"], bst])

    def dump(name, obj):
        (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    dump("pokedex.json", index)
    dump("moves.json", moves)
    dump("abilities.json", abilities)
    print(f"Fertig: {len(index)} Pokémon, {len(moves)} Attacken, {len(abilities)} Fähigkeiten -> {OUT}")


if __name__ == "__main__":
    main()
