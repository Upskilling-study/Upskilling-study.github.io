#!/usr/bin/env python3
"""ABC Tutoring study prototype server.

Uses only the Python standard library. Serves the static website and provides:
- GET  /api/availability
- POST /api/bookings

Bookings are stored in data/bookings.json. Optional Resend/Twilio notifications
are configured through environment variables or a local .env file.
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlparse, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
BOOKINGS_FILE = DATA_DIR / "bookings.json"
PORT = int(os.environ.get("PORT", "8000"))
WRITE_LOCK = threading.Lock()

BOOKABLE_SLOTS = {
    "math-1": {"demo-math-1-tue-1600", "demo-math-1-thu-1730"},
    "math-2": {"demo-math-2-mon-1630", "demo-math-2-wed-1800"},
    "math-3": {"demo-math-3-tue-1800", "demo-math-3-sat-1000"},
    "math-4": {"demo-math-4-wed-1530", "demo-math-4-fri-1700"},
    "science-1": {"demo-science-1-mon-1800", "demo-science-1-thu-1600"},
    "reading-1": {"demo-reading-1-tue-1530", "demo-reading-1-sat-1100"},
}

TUTOR_NAMES = {
    "math-1": "Math Tutor 1",
    "math-2": "Math Tutor 2",
    "math-3": "Math Tutor 3",
    "math-4": "Math Tutor 4",
    "science-1": "Science Tutor",
    "reading-1": "Reading Tutor",
}

SLOT_LABELS = {
    "demo-math-1-tue-1600": "Tuesday · 4:00 PM",
    "demo-math-1-thu-1730": "Thursday · 5:30 PM",
    "demo-math-2-mon-1630": "Monday · 4:30 PM",
    "demo-math-2-wed-1800": "Wednesday · 6:00 PM",
    "demo-math-3-tue-1800": "Tuesday · 6:00 PM",
    "demo-math-3-sat-1000": "Saturday · 10:00 AM",
    "demo-math-4-wed-1530": "Wednesday · 3:30 PM",
    "demo-math-4-fri-1700": "Friday · 5:00 PM",
    "demo-science-1-mon-1800": "Monday · 6:00 PM",
    "demo-science-1-thu-1600": "Thursday · 4:00 PM",
    "demo-reading-1-tue-1530": "Tuesday · 3:30 PM",
    "demo-reading-1-sat-1100": "Saturday · 11:00 AM",
}

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def load_dotenv(path: Path) -> None:
    """Tiny .env loader so no third-party package is required."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def ensure_bookings_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not BOOKINGS_FILE.exists():
        BOOKINGS_FILE.write_text("[]\n", encoding="utf-8")


def read_bookings() -> list[dict]:
    ensure_bookings_file()
    try:
        parsed = json.loads(BOOKINGS_FILE.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def save_bookings(bookings: list[dict]) -> None:
    temp = BOOKINGS_FILE.with_suffix(".json.tmp")
    temp.write_text(json.dumps(bookings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(BOOKINGS_FILE)


def clean(value, max_len=120) -> str:
    return str(value or "").strip()[:max_len]


def validate_booking(payload: dict):
    booking = {
        "tutor": clean(payload.get("tutor"), 40),
        "slot": clean(payload.get("slot"), 80),
        "parentName": clean(payload.get("parentName")),
        "parentEmail": clean(payload.get("parentEmail"), 200).lower(),
        "studentFirstName": clean(payload.get("studentFirstName")),
        "grade": clean(payload.get("grade"), 40),
        "subject": clean(payload.get("subject"), 80),
        "format": clean(payload.get("format"), 40),
    }
    missing = [key for key, value in booking.items() if not value]
    if missing:
        return None, f"Missing required fields: {', '.join(missing)}"
    if not EMAIL_RE.match(booking["parentEmail"]):
        return None, "Please provide a valid parent email."
    if booking["slot"] not in BOOKABLE_SLOTS.get(booking["tutor"], set()):
        return None, "That tutor/time is not a valid posted opening."
    if booking["format"] not in {"In person", "Online"}:
        return None, "Invalid session format."
    return booking, None


def build_notification_text(record: dict) -> str:
    return "\n".join([
        "New ABC Tutoring booking",
        f"Parent: {record['parentName']}",
        f"Parent email: {record['parentEmail']}",
        f"Student: {record['studentFirstName']} ({record['grade']})",
        f"Subject: {record['subject']}",
        f"Tutor: {TUTOR_NAMES.get(record['tutor'], record['tutor'])}",
        f"Time: {record.get('slotLabel', record['slot'])}",
        f"Format: {record['format']}",
        f"Booked at: {record['bookedAt']}",
        f"Booking ID: {record['id']}",
    ])


def send_email_notification(record: dict) -> dict:
    api_key = os.environ.get("RESEND_API_KEY")
    to = os.environ.get("DANA_EMAIL")
    from_email = os.environ.get("RESEND_FROM_EMAIL")
    if not all([api_key, to, from_email]):
        return {"attempted": False, "channel": "email"}

    body = json.dumps({
        "from": from_email,
        "to": [to],
        "subject": f"New ABC Tutoring booking — {record['subject']}",
        "text": build_notification_text(record),
    }).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"email_{response.status}")
    return {"attempted": True, "channel": "email"}


def send_sms_notification(record: dict) -> dict:
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_phone = os.environ.get("TWILIO_FROM_PHONE")
    to = os.environ.get("DANA_PHONE")
    if not all([sid, token, from_phone, to]):
        return {"attempted": False, "channel": "sms"}

    form = urlencode({
        "From": from_phone,
        "To": to,
        "Body": build_notification_text(record)[:1500],
    }).encode("utf-8")
    auth = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("ascii")
    request = Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
        data=form,
        method="POST",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urlopen(request, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"sms_{response.status}")
    return {"attempted": True, "channel": "sms"}


def notify_owner(record: dict) -> list[dict]:
    results = []
    for sender, channel in [(send_email_notification, "email"), (send_sms_notification, "sms")]:
        try:
            results.append(sender(record))
        except (HTTPError, URLError, TimeoutError, RuntimeError, OSError) as error:
            print(f"Owner {channel} notification failed: {error}")
            results.append({"attempted": True, "channel": channel, "error": True})

    if not any(item.get("attempted") for item in results):
        print("\n[ABC Tutoring study notification preview]\n" + build_notification_text(record) + "\n")
    return results


class Handler(BaseHTTPRequestHandler):
    server_version = "ABCTutoringStudy/1.0"

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None, "Invalid request length."
        if length > 32000:
            return None, "Request too large."
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(payload, dict):
                return None, "Invalid JSON."
            return payload, None
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "Invalid JSON."

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/availability":
            bookings = read_bookings()
            self.send_json(HTTPStatus.OK, {
                "booked": [
                    {"tutor_id": b["tutor"], "slot_id": b["slot"], "booked_at": b["bookedAt"]}
                    for b in bookings
                ]
            })
            return
        self.serve_static(parsed.path, head_only=False)

    def do_HEAD(self):
        self.serve_static(urlparse(self.path).path, head_only=True)

    def do_POST(self):
        if urlparse(self.path).path != "/api/bookings":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return

        payload, body_error = self.read_json_body()
        if body_error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": body_error})
            return

        booking, validation_error = validate_booking(payload)
        if validation_error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": validation_error})
            return

        with WRITE_LOCK:
            bookings = read_bookings()
            duplicate = any(
                item.get("tutor") == booking["tutor"] and item.get("slot") == booking["slot"]
                for item in bookings
            )
            if duplicate:
                self.send_json(HTTPStatus.CONFLICT, {
                    "ok": False,
                    "code": "slot_booked",
                    "error": "That opening was just booked. Please choose another time.",
                })
                return

            record = {
                "id": str(uuid.uuid4()),
                **booking,
                "slotLabel": SLOT_LABELS.get(booking["slot"], booking["slot"]),
                "bookedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            bookings.append(record)
            save_bookings(bookings)

        # Notification is best-effort after the reservation has been persisted.
        notification = notify_owner(record)
        self.send_json(HTTPStatus.CREATED, {
            "ok": True,
            "booking_id": record["id"],
            "booked_at": record["bookedAt"],
            "notification": [
                {
                    "channel": item.get("channel", "unknown"),
                    "attempted": bool(item.get("attempted")),
                    "error": bool(item.get("error")),
                }
                for item in notification
            ],
        })

    def serve_static(self, request_path: str, head_only: bool):
        path_text = unquote(request_path or "/")
        if path_text == "/":
            path_text = "/index.html"

        relative = path_text.lstrip("/")
        candidate = (ROOT / relative).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return

        # Never expose stored booking records or server secrets as static files.
        try:
            candidate.relative_to(DATA_DIR)
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        except ValueError:
            pass
        if candidate.name in {".env", "server.py", "server.mjs"}:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return

        if not candidate.is_file():
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return

        mime, _ = mimetypes.guess_type(str(candidate))
        content_type = mime or "application/octet-stream"
        if content_type.startswith("text/") or candidate.suffix in {".js", ".json", ".md"}:
            content_type += "; charset=utf-8"
        data = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)


def main():
    load_dotenv(ROOT / ".env")
    ensure_bookings_file()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"ABC Tutoring study server running at http://localhost:{PORT}")
    print(f"Bookings are saved to {BOOKINGS_FILE}")
    if not os.environ.get("RESEND_API_KEY") and not os.environ.get("TWILIO_ACCOUNT_SID"):
        print("Owner notification providers are not configured; booking notifications will be previewed in this terminal.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
