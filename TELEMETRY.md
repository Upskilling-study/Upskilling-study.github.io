# PostHog Telemetry — ABC Tutoring Study Prototype

## Purpose
Measure whether parents can discover a tutor, find an available time, and complete a booking. Parent/student form contents are intentionally excluded from PostHog.

## Browser configuration
The project token and US ingestion host are configured in `js/site-data.js`. The browser SDK is initialized in `js/telemetry.js` with:
- pageview/pageleave tracking
- autocapture disabled
- session recording disabled
- surveys disabled
- person profiles disabled
- Do Not Track respected
- sensitive form marked `ph-no-capture`
- property filtering before events are sent

## Custom event schema
| Event | When it fires | Example safe properties |
|---|---|---|
| `facebook clicked` | Configured Facebook link opens | `location` |
| `facebook unavailable clicked` | Placeholder Facebook link is clicked | `location` |
| `tutor filter changed` | Subject filter changes | `subject_filter` |
| `tutor booking clicked` | Parent clicks a tutor booking CTA | `tutor_id`, `subject_key`, `hourly_rate`, `availability_count` |
| `booking form started` | First interaction with booking form | `tutor_id`, `entry_from_tutor` |
| `booking tutor selected` | Tutor selection changes | `tutor_id`, `subject_key`, `hourly_rate`, `availability_count` |
| `booking slot selected` | An available time is selected | `tutor_id`, `slot_id`, `slot_index`, `session_format` |
| `booking attempted` | Booking form is submitted | tutor/rate/slot/format metadata only |
| `booking completed` | Server successfully persists the booking | safe booking metadata, `persistence: server`, `owner_notification_attempted` |
| `booking failed` | Slot was already booked or endpoint failed | safe metadata + generic `reason` |
| `booking availability unavailable` | Selected tutor has no remaining posted openings | tutor/subject metadata only |

Never add parent name, parent email, student name, grade, notes, phone number, or other direct identifiers to PostHog events.

## Recommended funnel
1. `$pageview` on `tutors.html`
2. `tutor booking clicked`
3. `booking form started`
4. `booking slot selected`
5. `booking attempted`
6. `booking completed`

Useful breakdowns: `subject_key`, `tutor_id`, `session_format`, and `hourly_rate`.

## Booking-state separation
PostHog is analytics only. The booking backend stores the parent/student details needed for Dana to follow up. The public availability endpoint exposes only booked tutor/slot metadata, and PostHog never receives the form contents.

## Synthetic traffic
`scripts/simulate_posthog_traffic.py` generates anonymous synthetic funnel events and marks them `simulation: true`.

```bash
python3 scripts/simulate_posthog_traffic.py --visitors 20 --dry-run
POSTHOG_PROJECT_TOKEN='phc_...' python3 scripts/simulate_posthog_traffic.py --visitors 20 --send
```
