# ShorelySafe Outreach Map

An interactive Jersey Shore outreach dashboard: town map, attributed recipients, email subjects, clicked links, event types, search, date filters, and CSV export. Built for Bay Head, Lavallette, Surf City, Long Beach Township, and Beach Haven. Towns outside this set stay unassigned rather than receiving invented coordinates.

**Public application, private records.** No contact records, email content, click history, credentials, or real activity are bundled in this repository or published website. Imported files remain in the browser; persistence is opt-in. The sample preview is clearly labeled and contains only example.org addresses. A map provider receives ordinary map tile requests, never imported contact or event records.

## Run

Requires Node 20 or newer, no package installation:

```sh
npm test
npm start
```

Open http://127.0.0.1:8870. The GitHub Pages deployment serves the same browser app. It does not run the optional Node feed server.

## Load actual activity

Use **Import activity** to select a CSV or JSON file, or paste records under **Data sources → Or paste CSV / JSON**. Files up to 5 MB and 50,000 events are supported. New files merge into existing records, with duplicate events counted once. Invalid timestamps and event types are reported and skipped; an entirely invalid file does not replace existing data. No actual records are included with this repository.

CSV headers:

```csv
Event ID,Event type,Timestamp,Town,Contact name,Recipient,Subject,Email ID,Clicked URL,Attribution,Source,Bot
example-1,click,2026-10-14T12:00:00Z,Bay Head,Example contact,example@example.org,Example outreach,email-1,https://example.org,identified,Example only,false
```

JSON snapshot:

```json
{
  "version": 1,
  "source": {"name": "Your verified activity export"},
  "contacts": [{"email": "example@example.org", "name": "Example contact", "town": "Bay Head"}],
  "emails": [{"id": "email-1", "subject": "Example outreach", "town": "Bay Head"}],
  "events": [{"id": "example-1", "type": "click", "timestamp": "2026-10-14T12:00:00Z", "recipient": "example@example.org", "emailId": "email-1", "url": "https://example.org", "attribution": "identified", "bot": false}]
}
```

Supported event types: `click`, `open`, `reply`, `sent`, `delivered`, `bounce`, `deferred`. Timestamps accept ISO dates and epoch milliseconds/seconds. Explicit event municipality takes priority, then contact municipality, email municipality, and finally a single unambiguous town name in the subject.

For unknown/group recipients use `"attribution":"unknown"` and omit `recipient`. Multiple recipient addresses are never treated as one identified person. Unknown clickers remain unknown even when the town/email can be identified. Bot-flagged events are excluded from summary totals; the checkbox includes them in the list only. Export includes the bot flag and neutralizes spreadsheet formulas in text cells.

## HubSpot connection limits

This app is **not automatically connected** to the HubSpot integration inside ChatGPT. Reconnecting that integration does not authorize a separate GitHub Pages website. A public static website cannot safely hold a HubSpot private app token.

HubSpot's Outlook one-to-one sales tracking differs from marketing email events. This app does not falsely use the marketing events API for sales-email tracking and does not claim to fetch one-to-one click events automatically. Supply verified event records from an available export/integration or an authenticated snapshot feed. CRM email records, contact-level aggregate click properties, and marketing events are not interchangeable with individual sales-click events.

A tracked link click does not prove a video attachment was watched. Multiple To/CC/BCC recipients can produce unattributed activity. The municipality on the map is the recipient's associated town, not IP geolocation or physical click location. See [HubSpot's tracking documentation](https://knowledge.hubspot.com/connected-email/understand-hubspot-sales-email-open-and-click-tracking).

## Optional private feed

`server.mjs` can serve a private normalized JSON snapshot from disk at `/api/snapshot`. It is a feed adapter, not a HubSpot event collector. Provision it on your own authenticated HTTPS server and update the snapshot with an independently authorized source. Never upload the file, access key, or HubSpot token to GitHub.

```sh
DASHBOARD_KEY='your-random-at-least-32-character-key' \
ALLOWED_ORIGIN='https://hondrospj.github.io' \
ACTIVITY_FILE='/absolute/private/path/activity.json' \
HOST='127.0.0.1' npm start
```

Environment variables are read from the process, not automatically from `.env`. The server binds to loopback by default; public binds require a key of at least 32 characters. Run behind TLS and a reverse proxy for external access. Each snapshot request requires `Authorization: Bearer <dashboard-key>`. Cross-origin access is limited to the configured origin; static serving uses an explicit asset allowlist that excludes private files.

Enter the HTTPS snapshot URL and dashboard key under **Data sources**. The browser retains the key only in memory and refreshes every 30 seconds while visible. Disconnect or close the page to stop refreshing. Failed requests preserve the last successful view and display the failure. The dashboard key is for this feed, **never a HubSpot private app token**. Avoid third-party shared computers for private records; Clear activity removes saved browser data.

## Deployment

The Pages workflow tests and deploys only an explicit list of public assets. Enable GitHub Pages with **GitHub Actions** as its source. Push to `main` to publish. No build system or third-party runtime dependencies are required. Leaflet 1.9.4 is vendored with its BSD license. Base map: OpenStreetMap, with attribution and standard interactive tile usage. Municipal geometries originate from the existing public town floodmapper boundary datasets, retained without private properties.

## Validation

Node tests cover normalization, attribution ambiguity, invalid records, malicious URL rejection, bot exclusion, duplicate merging, quoted CSV, formula-safe export, and server authorization/private-file protection. Browser checks cover town selection, search, sample separation, import, and responsive layouts.
