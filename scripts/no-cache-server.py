#!/usr/bin/env python3
"""Static file server for dev preview that disables all caching, so edited
files are always reflected immediately instead of being served stale from
the browser's HTTP cache."""

import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4174
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = lambda *args, **kwargs: NoCacheHandler(*args, directory=directory, **kwargs)
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
