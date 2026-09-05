#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
checks = []
for page in ["index.html", "tutors.html", "booking.html", "about.html"]:
    text = (root/page).read_text(encoding="utf-8")
    checks.append((f"{page}: telemetry loaded", 'js/telemetry.js' in text))
checks += [
    ("telemetry: PostHog init", "posthog.init" in (root/"js/telemetry.js").read_text()),
    ("telemetry: autocapture disabled", "autocapture: false" in (root/"js/telemetry.js").read_text()),
    ("telemetry: session recording disabled", "disable_session_recording: true" in (root/"js/telemetry.js").read_text()),
    ("telemetry: person profiles disabled", "person_profiles: 'never'" in (root/"js/telemetry.js").read_text()),
    ("booking form marked sensitive", "ph-no-capture" in (root/"booking.html").read_text()),
    ("main: tutor click event", "tutor booking clicked" in (root/"js/main.js").read_text()),
    ("main: slot selected event", "booking slot selected" in (root/"js/main.js").read_text()),
    ("main: completed booking event", "booking completed" in (root/"js/main.js").read_text()),
    ("python server exists", (root/"server.py").exists()),
    ("server: availability endpoint", "/api/availability" in (root/"server.py").read_text()),
    ("server: booking endpoint", "/api/bookings" in (root/"server.py").read_text()),
]
failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(("PASS" if ok else "FAIL") + "  " + name)
raise SystemExit(1 if failed else 0)
