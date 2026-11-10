"""Loopback-only Parasolid reader for STP Studio."""

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from parasolid_kit import read_brep
from parasolid_kit.interop.occt import to_occt
from parasolid_kit.interop.preview import PreviewOptions, write_preview


ALLOWED_ORIGINS = {
    "https://step-web-viewer.pages.dev",
    "http://127.0.0.1:5181",
    "http://127.0.0.1:5173",
}
MAX_BYTES = 25 * 1024 * 1024


class Reader(BaseHTTPRequestHandler):
    timeout = 15

    def respond(self, status, body=b"", content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def validate_request(self):
        if (
            self.headers.get("Host") != "127.0.0.1:8788"
            or self.headers.get("Origin") not in ALLOWED_ORIGINS
        ):
            self.respond(403, b"Origin is not allowed.")
            return False
        if self.path != "/parasolid":
            self.respond(404)
            return False
        return True

    def do_OPTIONS(self):
        if self.validate_request():
            self.respond(204)

    def do_POST(self):
        if not self.validate_request():
            return
        if self.headers.get_content_type() != "application/octet-stream":
            self.respond(415, b"Expected a Parasolid file.")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BYTES:
            self.respond(413, b"Parasolid files must be non-empty and at most 25 MB.")
            return
        try:
            data = self.rfile.read(length)
        except TimeoutError:
            self.respond(408, b"Timed out while reading the file.")
            return
        if len(data) != length or b"**PARASOLID" not in data[:1024]:
            self.respond(400, b"Expected a Parasolid text transmit file (.x_t).")
            return
        try:
            with TemporaryDirectory(prefix="stp-studio-xt-") as directory:
                source = Path(directory) / "input.x_t"
                source.write_bytes(data)
                parsed = read_brep(source)
                converted = to_occt(parsed.brep, source_unit="m", target_unit="mm")
                output = Path(directory) / "preview"
                write_preview(
                    converted, parsed.brep, output,
                    options=PreviewOptions(include_edges=False),
                )
                glb = (output / "preview.glb").read_bytes()
        except Exception as error:
            self.log_error("Parasolid conversion failed: %s", error)
            self.respond(422, b"The reader could not convert this Parasolid model completely.")
            return
        self.respond(200, glb, "model/gltf-binary")


if __name__ == "__main__":
    with HTTPServer(("127.0.0.1", 8788), Reader) as server:
        print("STP Studio Parasolid reader listening on http://127.0.0.1:8788", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
