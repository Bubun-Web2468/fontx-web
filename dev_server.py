#!/usr/bin/env python3
"""
FontX — Zero-Dependency Local Web Server
Run this script with: python dev_server.py
"""

import os
import sys
import webbrowser
import threading
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

PORT = 8080

class FontXHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.eot': 'application/vnd.ms-fontobject',
        '.wasm': 'application/wasm',
    }

    def guess_type(self, path):
        # Guarantee correct MIME type regardless of Windows Registry settings
        base, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext in self.extensions_map:
            return self.extensions_map[ext]
        return super().guess_type(path)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/process-font':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                import json
                import base64
                req = json.loads(post_data.decode('utf-8'))
                raw_bytes = base64.b64decode(req['base64'])
                target_format = req.get('format', 'ttf')

                try:
                    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    sys.path.insert(0, parent_dir)
                    from main import process_font_bytes
                    processed = process_font_bytes(raw_bytes, target_format)
                except Exception as ex:
                    print(f"Server font processing fallback: {ex}")
                    processed = raw_bytes

                resp = {
                    'success': True,
                    'base64': base64.b64encode(processed).decode('utf-8')
                }
                resp_bytes = json.dumps(resp).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
                return
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
                return
        super().do_POST()

def run_server():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)
    
    TCPServer.allow_reuse_address = True
    with TCPServer(('127.0.0.1', PORT), FontXHandler) as httpd:
        url = f"http://127.0.0.1:{PORT}/index.html"
        print("=" * 60)
        print("  FontX — TTF/OTF Web Font Editor")
        print(f"  Server running at: {url}")
        print("  Press Ctrl+C to stop the server.")
        print("=" * 60)
        
        # Open default browser after 0.5 seconds
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run_server()
