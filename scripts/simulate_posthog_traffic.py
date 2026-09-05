#!/usr/bin/env python3
"""Generate synthetic, anonymous ABC Tutoring funnel events for PostHog.

Default behavior is dry-run unless --send is supplied. All generated events have
simulation=true and $process_person_profile=false, so they are easy to filter and
do not create person profiles.
"""
import argparse
import json
import os
import random
import sys
import uuid
from datetime import datetime, timezone
from urllib import request, error

TUTORS = [
    ("math-1", "math", 45, "Online"),
    ("math-2", "math", 50, "Online"),
    ("math-3", "math", 55, "In person"),
    ("math-4", "math", 40, "Online"),
    ("science-1", "science", 50, "In person"),
    ("reading-1", "reading", 45, "Online"),
]


def event(distinct_id, name, properties=None):
    props = {
        "$process_person_profile": False,
        "simulation": True,
        "study": "abc_tutoring_prototype",
    }
    props.update(properties or {})
    return {
        "event": name,
        "distinct_id": distinct_id,
        "properties": props,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def visitor_journey(rng):
    distinct_id = f"sim-{uuid.uuid4()}"
    tutor_id, subject, rate, fmt = rng.choice(TUTORS)
    events = [
        event(distinct_id, "$pageview", {"$current_url": "https://prototype.example/index.html", "$pathname": "/index.html"}),
    ]
    if rng.random() < 0.92:
        events.append(event(distinct_id, "$pageview", {"$current_url": "https://prototype.example/tutors.html", "$pathname": "/tutors.html"}))
    else:
        return events
    if rng.random() < 0.82:
        events.append(event(distinct_id, "tutor booking clicked", {
            "tutor_id": tutor_id, "subject_key": subject, "hourly_rate": rate,
            "availability_count": 2, "prototype_data": True
        }))
    else:
        return events
    events.append(event(distinct_id, "$pageview", {"$current_url": f"https://prototype.example/booking.html?tutor={tutor_id}", "$pathname": "/booking.html"}))
    if rng.random() < 0.88:
        events.append(event(distinct_id, "booking form started", {"tutor_id": tutor_id, "entry_from_tutor": True, "prototype_data": True}))
    else:
        return events
    if rng.random() < 0.86:
        events.append(event(distinct_id, "booking slot selected", {"tutor_id": tutor_id, "slot_index": rng.choice([0, 1]), "session_format": fmt, "prototype_data": True}))
    else:
        return events
    if rng.random() < 0.90:
        safe = {"tutor_id": tutor_id, "subject_key": subject, "hourly_rate": rate, "session_format": fmt, "prototype_data": True}
        events.append(event(distinct_id, "booking attempted", safe))
        if rng.random() < 0.96:
            events.append(event(distinct_id, "booking demo submitted", safe))
    return events


def send_event(host, token, payload):
    body = json.dumps({
        "api_key": token,
        "event": payload["event"],
        "distinct_id": payload["distinct_id"],
        "properties": payload["properties"],
        "timestamp": payload["timestamp"],
    }).encode("utf-8")
    req = request.Request(host.rstrip("/") + "/i/v0/e/", data=body, headers={"Content-Type": "application/json"}, method="POST")
    with request.urlopen(req, timeout=10) as response:
        return response.status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--visitors", type=int, default=20)
    parser.add_argument("--seed", type=int, default=42)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--send", action="store_true", help="Send events to PostHog")
    mode.add_argument("--dry-run", action="store_true", help="Print sample/summaries without sending (default)")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    journeys = [visitor_journey(rng) for _ in range(args.visitors)]
    all_events = [e for journey in journeys for e in journey]

    counts = {}
    for e in all_events:
        counts[e["event"]] = counts.get(e["event"], 0) + 1

    print(f"Synthetic visitors: {args.visitors}")
    print(f"Synthetic events:   {len(all_events)}")
    print("Event counts:")
    for name, count in sorted(counts.items()):
        print(f"  {name:26s} {count}")

    if not args.send:
        print("\nDry run: no network requests sent.")
        print("Sample event:")
        print(json.dumps(all_events[0], indent=2))
        return 0

    token = os.getenv("POSTHOG_PROJECT_TOKEN", "")
    host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
    if not token:
        print("ERROR: POSTHOG_PROJECT_TOKEN is required with --send", file=sys.stderr)
        return 2

    sent = 0
    try:
        for payload in all_events:
            status = send_event(host, token, payload)
            if 200 <= status < 300:
                sent += 1
    except (error.URLError, TimeoutError) as exc:
        print(f"ERROR after {sent} events: {exc}", file=sys.stderr)
        return 3

    print(f"\nSent {sent}/{len(all_events)} synthetic events to {host}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
