# ABC Tutoring — PostHog-Instrumented Study Prototype

A responsive tutoring-site prototype built from the Dana customer interview. It includes shared tutor availability, server-backed booking, optional owner email/SMS notifications, and PostHog funnel telemetry.

## Pages
- `index.html` — Home
- `tutors.html` — Six tutor profiles with rate + weekly availability
- `booking.html` — Tutor-first, one-hour booking flow
- `about.html` — Service details + FAQs

## Customer requirements represented
- K–12 tutoring, mostly middle school
- In-person and online sessions
- Elementary math through Algebra II, science, and elementary reading
- Six tutors: four math, one science, one reading
- One-on-one, usually 60-minute sessions
- Individual tutor rates in the $40–$55/hour range
- Tutor names/photos remain placeholders until Dana supplies the real information
- Facebook links remain placeholders until Dana supplies the exact page URL
- Weekly tutor availability is visible before booking
- Parents can book without calling or texting
- A successful booking updates shared availability for every visitor
- The server rejects a second booking for an already-reserved tutor/time
- Dana can be notified by email and/or SMS when provider credentials are configured

## Study data
Tutor names, photos, exact rates, and weekly openings are clearly labeled demo data in `js/site-data.js`. Replace those values when Dana supplies the real roster and current schedule.

## Run the working prototype
This build now requires the included Node server because bookings are shared and stored server-side.

```bash
node server.mjs
```

Then open:

```text
http://localhost:8000
```

No npm packages are required. Node 18+ is sufficient.

### Reset study bookings

```bash
python3 scripts/reset_bookings.py
```

Restart the server (or make another request) and the empty booking store will be recreated.

## Booking storage
The server writes real form submissions to `data/bookings.json`. That file is intentionally in `.gitignore` because it contains parent/student contact information and must never be committed.

The shared public availability endpoint returns only tutor ID, slot ID, and booking timestamp — never parent/student information.

## Owner notifications
Copy `.env.example` to `.env` and fill in only the notification channel(s) you want to demonstrate.

### Email via Resend
Required variables:

```text
DANA_EMAIL=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
```

### SMS via Twilio
Required variables:

```text
DANA_PHONE=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_PHONE=...
```

Start the server with the environment file:

```bash
node --env-file=.env server.mjs
```

If neither provider is configured, bookings still work and the server prints a notification preview in the terminal so the study flow can be demonstrated safely.

## PostHog telemetry
See `TELEMETRY.md` for the event schema and recommended funnel.

The study project token is configured in `js/site-data.js`, using the US ingestion host. The browser telemetry intentionally excludes parent/student form values. Autocapture, session recording, surveys, and person profiles are disabled.

Validate the instrumentation:

```bash
python3 scripts/validate_telemetry.py
```

or run all local checks:

```bash
npm run check
```

## Simulate PostHog traffic
Dry run:

```bash
python3 scripts/simulate_posthog_traffic.py --visitors 20 --dry-run
```

Send synthetic events to PostHog:

```bash
POSTHOG_PROJECT_TOKEN='phc_...' python3 scripts/simulate_posthog_traffic.py --visitors 20 --send
```

Synthetic events are tagged `simulation: true` so they can be filtered from real traffic.

## Before a real launch
- Replace tutor placeholder names/photos with Dana's real tutors.
- Replace demo rates and weekly times with Dana's current values.
- Add the real Facebook page URL.
- Put booking storage in a managed database rather than a local JSON file.
- Add authentication/admin tooling if Dana needs an online booking dashboard.
- Use production notification credentials and verify the email/SMS sender.
- Review privacy, consent, retention, and security requirements for the business's jurisdiction.
