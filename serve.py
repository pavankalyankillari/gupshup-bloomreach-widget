"""Static file server for local dev that disables caching, so iterative
edits to index.html/styles.css/app.js are always reflected immediately
instead of the browser serving a stale cached copy."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    http.server.test(HandlerClass=NoCacheHandler, port=port)
