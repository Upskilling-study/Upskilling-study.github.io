#!/usr/bin/env python3
from pathlib import Path

bookings = Path(__file__).resolve().parents[1] / "data" / "bookings.json"
bookings.unlink(missing_ok=True)
print("Study bookings reset. The server will recreate an empty booking store on next start/request.")
