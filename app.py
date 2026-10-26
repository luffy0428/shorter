"""
Python Web Server for File Type Sorter Application.
Pure Python standard library implementation (http.server + socketserver).
Provides JSON REST API and serves modern HTML/CSS interface.
"""

import sys
import os
import json
import socket
import webbrowser
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

# Import core sorting and organization logic
import file_organizer

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_DEMO_DIR = BASE_DIR / "sample_test_folder"


class FileOrganizerRequestHandler(SimpleHTTPRequestHandler):
    """Custom HTTP request handler with REST API endpoints."""

    def _set_headers(self, status_code=200, content_type="application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length).decode("utf-8")
                return json.loads(raw_data)
            return {}
        except Exception:
            return {}

    def _send_json(self, data, status_code=200):
        self._set_headers(status_code, "application/json")
        self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))

    def _send_error_json(self, message, status_code=400):
        self._send_json({"success": False, "error": str(message)}, status_code)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            index_path = STATIC_DIR / "index.html"
            if index_path.exists():
                self._set_headers(200, "text/html; charset=utf-8")
                with open(index_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "index.html not found")
            return

        elif path == "/style.css":
            css_path = STATIC_DIR / "style.css"
            if css_path.exists():
                self._set_headers(200, "text/css; charset=utf-8")
                with open(css_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "style.css not found")
            return

        elif path == "/app.js":
            js_path = STATIC_DIR / "app.js"
            if js_path.exists():
                self._set_headers(200, "application/javascript; charset=utf-8")
                with open(js_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "app.js not found")
            return

        elif path == "/api/system-info":
            # Quick suggestion paths for convenience
            user_home = Path.home()
            desktop = user_home / "Desktop"
            downloads = user_home / "Downloads"

            info = {
                "base_dir": str(BASE_DIR),
                "demo_dir": str(DEFAULT_DEMO_DIR),
                "user_home": str(user_home),
                "desktop_dir": str(desktop) if desktop.exists() else str(BASE_DIR),
                "downloads_dir": str(downloads) if downloads.exists() else str(BASE_DIR),
                "default_categories": file_organizer.DEFAULT_CATEGORIES
            }
            self._send_json(info)
            return

        else:
            self.send_error(404, f"Resource not found: {path}")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path == "/api/scan":
            directory = body.get("directory", "").strip()
            if not directory:
                return self._send_error_json("Directory path is required.")
            try:
                result = file_organizer.scan_directory(directory)
                self._send_json({"success": True, "data": result})
            except Exception as e:
                self._send_error_json(e, 400)

        elif path == "/api/organize":
            directory = body.get("directory", "").strip()
            dry_run = bool(body.get("dry_run", False))
            if not directory:
                return self._send_error_json("Directory path is required.")
            try:
                result = file_organizer.organize_directory(directory, dry_run=dry_run)
                self._send_json({"success": True, "data": result})
            except Exception as e:
                self._send_error_json(e, 400)

        elif path == "/api/undo":
            directory = body.get("directory", "").strip()
            if not directory:
                return self._send_error_json("Directory path is required.")
            try:
                result = file_organizer.undo_last_organization(directory)
                self._send_json({"success": True, "data": result})
            except Exception as e:
                self._send_error_json(e, 400)

        elif path == "/api/create-samples":
            directory = body.get("directory", "").strip() or str(DEFAULT_DEMO_DIR)
            try:
                result = file_organizer.create_dummy_sample_files(directory)
                self._send_json({"success": True, "data": result})
            except Exception as e:
                self._send_error_json(e, 400)

        else:
            self._send_error_json(f"Unknown POST endpoint: {path}", 404)

    def log_message(self, format, *args):
        # Override to keep server console logs clean and readable
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def find_free_port(start_port=8000, max_attempts=50):
    """Finds an open port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port


def start_server(port=None, auto_open_browser=True):
    """Starts the Python HTTP server and opens the browser."""
    if port is None:
        port = find_free_port(8000)

    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, FileOrganizerRequestHandler)
    url = f"http://localhost:{port}"

    print("=" * 65)
    print(f"  FILE TYPE SORTER PROTOTYPE")
    print(f"  Server running at: {url}")
    print(f"  Interface: HTML5 / CSS3 Modern Dashboard")
    print(f"  Core Logic: Pure Python Standard Library (Zero dependencies)")
    print("=" * 65)
    print("  Press Ctrl+C to stop the server anytime.\n")

    if auto_open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping File Organizer server...")
    finally:
        httpd.server_close()
        print("Server stopped.")


if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None
    start_server(port=port_arg, auto_open_browser=True)
