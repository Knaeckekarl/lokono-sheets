"""
Lokaler Testserver für Lokono Sheets – OHNE Browser-Cache.

Warum: "python -m http.server" erlaubt dem Browser, JS/CSS zu cachen. Nach Code-Änderungen
sieht man dann oft noch die alte Version. Dieser Server verbietet das Cachen.

Aufruf (aus dem Projektordner):
    python tools/serve.py          → http://localhost:8000
    python tools/serve.py 8080     → anderer Port
Beenden mit Strg+C.
"""

import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Windows meldet .js manchmal als text/plain → ES-Module würden dann nicht laden
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    print(f"Lokono Sheets läuft auf http://localhost:{port}  (Tests: /tests/ · Beenden: Strg+C)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    main()
