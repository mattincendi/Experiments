#!/usr/bin/env python3
"""Serve the world editor locally with shared memory allowed, so its climate can run on several cores.

Browsers give a page memory shared between workers only when it is served cross-origin isolated, with two headers
(Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp). This is Python's own static
file server with those two headers added. Run it from anywhere:

    python3 serve-world-editor.py            # serves this folder on http://localhost:8000
    python3 serve-world-editor.py 8080       # another port
    python3 serve-world-editor.py --dir PATH # another folder

then open the address it prints. In the editor, Climate tab, "Use all cores" is then available, and the pipeline's
run time reads "on N cores". Opened any other way (the published artifact, or the file itself) the editor runs as
before, on one core.
"""
import argparse
import http.server
import os


class Isolated(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('port', nargs='?', type=int, default=8000)
    ap.add_argument('--dir', default=os.path.dirname(os.path.abspath(__file__)))
    a = ap.parse_args()
    os.chdir(a.dir)
    with http.server.ThreadingHTTPServer(('127.0.0.1', a.port), Isolated) as srv:
        print(f'World editor: http://localhost:{a.port}/index.html  (Ctrl+C to stop)')
        srv.serve_forever()


if __name__ == '__main__':
    main()
