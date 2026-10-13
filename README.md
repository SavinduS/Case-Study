# Smart Wildlife Conservation and Anti-Poaching Monitoring System
Group 033 | SE3070 Case Studies in Software Engineering

- `frontend/mobile` — React Native app (Villager conflict report + Ranger offline incident)
- `frontend/web` — Desktop browser dashboard (Officer alerts + Manager analytics)
- `backend` — Node + MongoDB API

## Manage Wildlife Collar Boundary Alerts

Use case implemented by HANAAN M F A S (IT23594586) as part of Assignment 02.
The Operations Officer monitors GPS collar telemetry, detects geofence
breaches on the server, and dispatches a ranger response.

### Run it

The repo is an **npm workspace** (`backend`, `frontend/mobile`, `frontend/web`).
Install once from the repository root — there is a single `package-lock.json`
there, so do not run `npm install` inside a package folder.

```bash
cd <repo root>
npm install          # once, from the root
npm run seed         # park, geofences, collars, ranger teams (safe to re-run)
npm run dev          # starts the API and the dashboard together
```

Then open **http://localhost:5173**.

`npm run dev` starts both processes, so the dashboard is not stuck on
"Cannot reach the API". To run them separately instead, use two terminals:

```bash
npm run backend      # API on :5055
npm run web          # dashboard on :5173
```

**Both are required.** The dashboard only renders a map once the API answers;
it polls `/api`, and Vite proxies that to the backend so the browser stays on
one origin with no CORS setup and no base URL in the bundle.

| Command | Effect |
| --- | --- |
| `npm run dev` | API + dashboard together |
| `npm run backend` / `npm run web` | Run either one on its own |
| `npm run seed` | Upsert reference data + one demo login per role (safe to re-run) |
| `npm run seed:reset` | Clear alerts/audit/dispatches and restore collar positions |
| `npm run test` | Backend: Jest (conflict reports) then Vitest (collar alerts) |
| `npm run test:web` | Frontend Vitest suite |
| `TELEMETRY_SIMULATOR=false npm run backend` | Stop the server generating collar telemetry |

If the dashboard shows a red **Cannot reach the API** banner, the API is not
running (or is on a different port than `backend/.env` sets) — start
`npm run backend`. Use **Reset** on the banner to retry.

### Where the code lives

```
backend/
  models/        Collar, Geofence, Park, RangerTeam, BoundaryAlert,
                 AuditEntry, DispatchAttempt, Counter
  services/      geofenceService, alertService, notificationService,
                 telemetrySimulator
  controllers/   collar, geofence, alert, audit, telemetry
  middlewares/   auth, requireRole, operationsAccess, gatewayAuth
  routes/        collars, geofences, parks, alerts, audit, telemetry
  seed/          referenceData (shared), seedReferenceData, resetOperationalData

frontend/web/src/
  layout/                      Topbar (session + Sign out) + module rail
  layout/usePortalSession.js   Session for the dashboard, incl. app handoff
  components/ui/               Button, Badge, Modal, ModulePlaceholder
  pages/LoginPage.jsx          Portal sign-in (email or phone)
  pages/PortalModuleRoute.jsx  Placeholder route for other members' modules
  services/api.js              All HTTP calls
  services/session.js          Read / save / sign out the session
  features/collar-alerts/
    domain/labels.js           Display vocabulary only
    services/alertAlarm.js     Web Audio critical alarm (no asset needed)
    hooks/useCollarAlerts.js   Polls the API, sends officer responses
    hooks/useAlertAlarm.js     Sounds each newly announced alert exactly once
    components/map/            Leaflet map, markers, legend, map chrome
    components/alerts/         Critical alert modal + banner, queue, dialogs,
                               drawer, sound control
    components/panels/         Collar registry + geofence register
    pages/DashboardPage.jsx    Screen composition
  features/reports/components/AnalyticsShell.jsx  Shell for the reports workspace
```

### Division of responsibility

The **server decides, the browser displays**. Breach detection, severity
scoring, queue ordering and persistence all happen in `alertService`. The
dashboard holds no simulated data — it polls `/api` and renders what the
database returns. There is no `parkData.js` and no mock gateway on the
client.

The only simulated component is the physical collars themselves: the real
hardware is unavailable, so `telemetrySimulator` posts fixes to the ingest
endpoint on the server's behalf. Disable it with `TELEMETRY_SIMULATOR=false`
and post real fixes to `POST /api/telemetry/fixes`.

> If you share the Atlas cluster with a teammate, their running copy writes to
> the same `wildlife` database. Points you post can then be pre-empted by their
> simulator. For a deterministic run, point `MONGODB_URI` at a database of your
> own (for example `.../wildlife_local`) and seed that one.

### Access control

The collar, park, alert and audit routes are **officer and Park Manager only**.
`middlewares/operationsAccess.js` applies `auth` + `requireRole('officer',
'manager')` to the router, so a villager or ranger token gets `403` and an
anonymous caller gets `401` — hiding a menu item is never the only defence.
The dashboard attaches the session token in `services/api.js`, and a `401`
clears the session and returns the officer to `/login`.

The telemetry routes are gateway endpoints rather than user endpoints. They
accept an optional shared secret:

| `TELEMETRY_GATEWAY_TOKEN` | Behaviour |
| --- | --- |
| unset (default) | Open, so the bundled simulator and a local gateway need no configuration. |
| set | `X-Gateway-Token` must match (timing-safe), **or** the caller must present an officer/manager session. Anything else is `401`. |

### Ranger dispatch notifications

`services/notificationService.js` owns delivery, and what it returns is what the
officer is shown — a dispatch request is never reported as a delivered
notification.

| `RANGER_GATEWAY_URL` | Adapter |
| --- | --- |
| set | Real HTTP POST with a 5 s timeout. Non-2xx, timeout or transport error counts as a failed delivery. |
| unset (default) | **Labelled mock adapter.** Accepts the notification for a team whose `gatewayReachable` is not `false`. RT-03 ships with `gatewayReachable: false` so the retry limit and the "Failed Delivery — contact by radio" path can be demonstrated end to end. |

Three attempts are made either way, each written to `DispatchAttempt`, and the
numbers continue from what the alert already has so a re-task is unambiguous.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/collars` | Tracked collars with last fix |
| POST | `/api/collars` · PUT `/api/collars/:collarId/status` | Register / flag a collar |
| GET | `/api/geofences` | High-risk zones |
| PUT | `/api/geofences/:zoneId` | Show/hide a zone (also gates evaluation) |
| GET | `/api/parks/current` | Park boundary + surrounding settlements |
| GET | `/api/parks/ranger-teams` | Ranger teams |
| GET | `/api/parks/ranger-teams/nearest?lng=&lat=` | Dispatch suggestion |
| GET | `/api/alerts` | Open queue, ordered by priority |
| GET | `/api/alerts/:alertId` | One incident |
| POST | `/api/alerts/:alertId/respond` | All four officer responses |
| GET | `/api/alerts/:alertId/dispatch-attempts` | Retry log for exception flow 3 |
| GET | `/api/audit` · `/api/audit/delayed` | Audit trail, retroactive breaches |
| POST | `/api/telemetry/fixes` | Gateway ingest (single fix or batch) |
| PUT | `/api/telemetry/collars/:collarId/signal` | Report signal loss |

Everything except the two telemetry routes needs an officer or Park Manager
session; the telemetry routes take the gateway secret described above.

### Use case coverage

| Flow | Where |
| --- | --- |
| Main flow: telemetry -> geofence -> alert -> dispatch -> audit | `alertService.ingestFix` / `respondToAlert` |
| A. Animal remains in safe zone | `geofenceService.evaluateGeofence` returns `safe` |
| B. Simultaneous breaches prioritised | `priorityScore` + `GET /api/alerts` ordering |
| C. Manual override / false alarm | `mark_false_alarm` (notes required) |
| D. Offline delayed telemetry batch | `POST /api/telemetry/fixes` with `delayed: true` |
| Exception 1. Telemetry connection failure | `PUT /api/telemetry/collars/:id/signal` -> `SignalLostBanner` |
| Exception 2. Session expired | A `401` clears the session and redirects to `/login` (`App.jsx` + `services/api.js`) |
| Exception 3. Dispatch failed after retries | `alertService.sendDispatch` + `notificationService`, 3 attempts logged |
| Audible + visible critical alert | `services/alertAlarm.js`, `useAlertAlarm.js`, `CriticalAlertBanner.jsx` |

### The critical alert alarm

There is no audio file in the repository, so the siren is synthesised with the
Web Audio API (two alternating tones, ~1.3 s). That keeps it dependency-free
and — unlike an `<audio>` element — cancellable, so it cannot keep sounding
after the officer leaves the page.

| Rule | Where |
| --- | --- |
| Sounded once per **newly announced** alert, never per poll | `useCollarAlerts` publishes `announced`, `useAlertAlarm` sounds each entry once |
| A second alert inside the same pattern does not stack a second siren | `createAlarm.play()` returns `playing` |
| Mute / unmute, remembered across reloads | `SoundControl.jsx`, `@wildlife-alert/alarm-muted` |
| Autoplay refused -> "Enable alert sound" button | `useAlertAlarm` reports `blocked` |
| Silent while muted, and on browsers with no Web Audio | `createAlarm.play()` returns `muted`; a written notice replaces the control |
| Stops on unmount | `useAlertAlarm` calls `alarm.stop()` in its cleanup |
| Visible even when the sound is off | `CriticalAlertBanner.jsx`, with its own silence control that never resolves the incident |

### Tests

```bash
cd backend      && npm test           # 215 Jest + 172 Vitest
cd frontend/web && npm test           # 224 tests

npm run test:coverage    # enforces the thresholds below
```

Jest suites each get their own database (`tests/helpers/db.js` derives one from
the suite name). They used to share a single `wildlife_test`, and one suite's
`dropDatabase()` raced the next suite's first write — a login answered `401` for
a user created a moment earlier. Isolating by suite removed the flakiness.

| Package | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| backend | 96.5% | 87.8% | 96.2% | 96.5% |
| frontend/web | 98.4% | 93.1% | 88.0% | 98.4% |

Both `vitest.config` files set thresholds (80% lines/functions/statements,
70–75% branches) so `npm run test:coverage` fails the build if coverage drops.

| Area | What is covered |
| --- | --- |
| `utils/geo.js` | Haversine, point-in-polygon (incl. concave), segment distance, coordinate validation |
| `services/geofenceService.js` | Zone evaluation, multi-zone severity preference, nearest ranger, severity monotonicity, queue priority |
| `services/alertService.js` | Ingest, one-alert-per-episode suppression, false-alarm cooldown, all four responses, 3-retry dispatch, malformed input |
| `services/telemetrySimulator.js` | Scripted tracks, signal loss, batch replay, deterministic seed, no overlapping ticks |
| `controllers/*` | Status codes (200/201/400/404/409), param parsing, error forwarding |
| `services/api.js` | Request shape, every endpoint, network failure, non-JSON error page |
| `hooks/useCollarAlerts.js` | Polling, critical-alert announcement, response actions, geofence toggles |
| `components/**` | Critical alert modal and banner, false alarm validation, queue ordering, dispatch-failure wording, sound control, geofence and collar panels, placeholders |
| `services/alertAlarm.js` + `hooks/useAlertAlarm.js` | Tone pattern, mute, blocked autoplay, one sound per new alert, cleanup on unmount |
| `App.jsx` / `services/session.js` | Route guards per role, 401 sign-out, no Admin route for the officer |

`DashboardMap.jsx` is excluded from the frontend coverage figure because
Leaflet needs a real layout engine; its rendering is verified separately in a
headless browser.

### Correctness notes

- **Severity is monotonic.** Approaching -> inside -> deep inside only
  escalates, plus settlement proximity.
- **One alert per breach episode**, enforced by a unique partial index on
  `episodeKey` rather than a check-then-act query, so concurrent ingests
  cannot both open the same episode.
- **Alert reference IDs come from an atomic counter** (`findOneAndUpdate`
  `$inc`); `countDocuments() + 1` collides under concurrency.
- **Dismissed/resolved alerts suppress** re-alerts for 15 minutes so an
  officer is not handed the same false alarm on every transmission.
- **Coordinates are `[lng, lat]`** everywhere (GeoJSON). `leafletAdapter.js`
  is the single conversion point to Leaflet's `[lat, lng]`.
- **The acting officer comes from the token**, never from the request body, so
  the audit trail cannot be written under someone else's name. The display name
  rides in the JWT as a `name` claim.
- **A handled incident is terminal.** Acknowledging, monitoring, dismissing or
  re-dispatching a `dismissed` / `resolved` alert answers `409` instead of
  moving the status backwards.
- **Fix timestamps are validated.** A fix with an unparseable `at`, or one more
  than 30 days old, is rejected per-fix instead of being recorded as a
  misleading incident dated to the moment it arrived.
- **Audit references are atomic** (`AUD-000001` from the same `Counter` the
  alert and conflict-report references use), so restarts and parallel requests
  cannot collide.

## Mobile sign-in and role routing

One login screen for the app; the role in the token decides what opens next.

| Role | After sign-in |
| --- | --- |
| Park Manager | Analytics workspace (`/analytics/type`) in a WebView |
| Operations Officer | Collar alert dashboard (`/`) in a WebView |
| Ranger | Field app — offline incident capture (report → review → My Incidents) |
| Villager | Field app — conflict report (submit → pending/success → My Reports) |

Each role has its own home in the portal, on both surfaces: signing in on the
mobile app opens the matching dashboard path, and the same is true of the web
sign-in page. A Park Manager who lands on `/` is moved to the analytics
workspace rather than the officer dashboard.

### Try it

```bash
npm run seed     # also creates one demo account per role
npm run backend  # the login screen talks to this
npm run mobile   # expo start
```

`npm run seed` writes these accounts (demo environment only). Every one of
them signs in with **either** the email address or the phone number, and the
password is `password123`:

| Role | Email | Phone | Lands on |
| --- | --- | --- | --- |
| Park Manager | `manager@wildlife.demo` | `+94770000001` | Analytics workspace |
| Operations Officer | `officer@wildlife.demo` | `+94770000002` | Collar alert dashboard |
| Ranger | `ranger@wildlife.demo` | `+94770000003` | Field app |
| Villager | `villager@wildlife.demo` | `+94770000004` | Field app |

### How it works

- `POST /api/auth/login` takes one `identifier` — an email address or a phone
  number — and returns `{ id, name, role, token }`. The role is decided by the
  server, never by the client. Emails are matched case-insensitively, and the
  old `phone` field is still accepted so existing callers keep working.
- `email` is optional and sparse on the `User` model: an account without one is
  valid, and many accounts without one do not collide on the unique index.
- **Mobile**: the session is kept on the device (`@wildlife-alert/session`).
  On every launch `GET /api/auth/me` revalidates it: an expired token or a
  deleted account returns to the login screen, an unreachable server keeps the
  stored session so the app stays usable offline.
- **Web dashboard opened in a browser**: `/login` signs in against the same
  endpoint and keeps the session in the browser's `localStorage`. Villager and
  Ranger accounts are refused — the dashboard is for Operations Officer and
  Park Manager. Every other route redirects to `/login` without a session.
- **The Operations Officer reaches the reports workspace too.** The officer
  needs the same incident, patrol and conflict figures to judge how urgent a
  dispatch is, so `backend/routes/analytics.js` admits `officer` alongside
  `manager` and the top bar carries a working **Reports** tab. Each role still
  only sees the reports it generated (`createdBy` scoping is unchanged), and
  `/api/analytics` still refuses villagers and rangers.
- **Navigation carries nothing the officer cannot use.** The top bar has
  exactly two tabs — **Dashboard** and **Reports** — and both open working
  features. Data Logs and Map View were placeholders for shared-platform
  modules, and the map is already the dashboard's full-bleed background, so
  neither earned a tab. The module rail offers the collar/alert/geofence panels
  this use case owns plus the other members' modules, each labelled with its
  owner; reports are a workspace, not a panel over the map, so they are not in
  the rail either. Administration is absent for the same reason — it is not this
  shift's work — and no backend route was removed to hide it.
- **The reports workspace has a way back.** The officer reaches it from the top
  bar, so `AnalyticsShell` carries a "Back to dashboard" link for that role.
  Without it they were trapped in what looked like the Park Manager's view. The
  Park Manager is not offered the link, because that workspace is their home.
- **The top bar names the role once.** The role label and the display name sat
  side by side saying the same thing, and the avatar initials took the first
  character of the first and last word — which for "Operations Officer (Demo)"
  produced the literal avatar `O(`. `initialsOf` now drops a trailing
  parenthetical qualifier and skips single-letter middle initials.
- **Web dashboard inside the app's WebView**: the session is handed over
  through `localStorage` (`@wildlife-alert/web-session`), never in the URL, so
  the token cannot end up in a history entry or an access log. If the page
  comes up without it, it asks the app (`requestSession`) and waits briefly
  rather than flashing the sign-in page.
- **Signing out** from the top bar clears the session and returns to `/login`
  in a browser, or tells the app (`signedOut`) so the phone returns to its own
  login screen. Ranger and Villager sign out from the bottom bar of their app.

### Where the code lives

```
backend/
  controllers/authController.js  register, login (email or phone), me
  routes/auth.js                 POST /register, POST /login, GET /me
  models/User.js                 name, phone, optional email, role
  seed/demoUsers.js              One demo login per role

frontend/mobile/src/
  auth/roles.ts                  Role -> destination mapping (unit-tested)
  auth/session.ts                AsyncStorage session (load/save/clear)
  auth/sessionShape.ts           Guards stored values before they are trusted
  screens/LoginScreen.tsx        Phone + password, inline errors, role legend
  screens/WebDashboardScreen.tsx WebView handoff for Manager/Officer
  screens/VillagerShell.tsx      Villager conflict-report flow
  App.tsx                        Session gate + role routing
```

### Addresses

The app finds the API on its own (`src/api/baseUrl.ts`). Two overrides exist
in `frontend/mobile/.env` if it cannot:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-pc-lan-ip>:5055   # API
EXPO_PUBLIC_WEB_UI_URL=http://<your-pc-lan-ip>:5173     # dashboard (Manager/Officer)
```

The dashboard address defaults to the Metro host on port 5173, which is where
`npm run web` serves it.

### Tests

```bash
npm run test -w backend            # includes tests/auth.test.js
npm run test -w frontend/mobile    # role routing + stored session shape
npm run typecheck -w frontend/mobile
```

`tests/auth.test.js` covers login (all four roles, missing fields, wrong
password answering the same as an unknown phone) and `/me` (valid token, no
token, bad token, deleted account).

## Linting (ESLint)

ESLint is configured at the repository root (`eslint.config.mjs`) and covers
all three workspaces: Node/CommonJS rules for `backend`, browser rules for the
web dashboard, and `typescript-eslint` + React Hooks rules for the mobile app.
Run it from the repository root in the VS Code terminal:

```bash
npm run lint                              # whole repo
npx eslint backend                        # one workspace
npx eslint frontend/mobile/src            # one folder
npx eslint backend/utils/smsParser.js     # a single file
npx eslint backend --format compact       # one line per problem
```

The output lists `error` findings (real problems) separately from `warning`
findings (smells such as unused variables). A clean run prints nothing and
exits with code 0; any `error` exits with code 1, so it can gate a commit or
CI job. Nothing is auto-fixed — `npx eslint <path> --fix` applies fixes only
when you ask for them.

For live feedback while typing, install the **ESLint** extension
(`dbaeumer.vscode-eslint`); the same findings appear as squiggles in the
editor without running the terminal command.