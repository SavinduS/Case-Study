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
  services/      geofenceService, alertService, telemetrySimulator
  controllers/   collar, geofence, alert, audit, telemetry
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
    hooks/useCollarAlerts.js   Polls the API, sends officer responses
    components/map/            Leaflet map, markers, legend, map chrome
    components/alerts/         Critical alert modal, queue, dialogs, drawer
    components/panels/         Collar registry + geofence register
    pages/DashboardPage.jsx    Screen composition
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

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/collars` | Tracked collars with last fix |
| GET | `/api/geofences` | High-risk zones |
| PUT | `/api/geofences/:zoneId` | Show/hide a zone (also gates evaluation) |
| GET | `/api/parks/current` | Park boundary + surrounding settlements |
| GET | `/api/parks/ranger-teams` | Ranger teams |
| GET | `/api/parks/ranger-teams/nearest?lng=&lat=` | Dispatch suggestion |
| GET | `/api/alerts` | Open queue, ordered by priority |
| POST | `/api/alerts/:alertId/respond` | All four officer responses |
| GET | `/api/alerts/:alertId/dispatch-attempts` | Retry log for exception flow 3 |
| GET | `/api/audit` · `/api/audit/delayed` | Audit trail, retroactive breaches |
| POST | `/api/telemetry/fixes` | Gateway ingest (single fix or batch) |
| PUT | `/api/telemetry/collars/:collarId/signal` | Report signal loss |

### Use case coverage

| Flow | Where |
| --- | --- |
| Main flow: telemetry -> geofence -> alert -> dispatch -> audit | `alertService.ingestFix` / `respondToAlert` |
| A. Animal remains in safe zone | `geofenceService.evaluateGeofence` returns `safe` |
| B. Simultaneous breaches prioritised | `priorityScore` + `GET /api/alerts` ordering |
| C. Manual override / false alarm | `mark_false_alarm` (notes required) |
| D. Offline delayed telemetry batch | `POST /api/telemetry/fixes` with `delayed: true` |
| Exception 1. Telemetry connection failure | `PUT /api/telemetry/collars/:id/signal` |
| Exception 2. Session expired | `SessionExpiredOverlay` (client-side until auth exists) |
| Exception 3. Dispatch failed after retries | `alertService.sendDispatch`, 3 attempts logged |

### Tests

```bash
cd backend      && npm test           # 168 tests
cd frontend/web && npm test           # 160 tests

npm run test:coverage    # enforces the thresholds below
```

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
| `components/**` | Critical alert modal, false alarm validation, queue ordering, geofence and collar panels, placeholders |

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

## Mobile sign-in and role routing

One login screen for the app; the role in the token decides what opens next.

| Role | After sign-in |
| --- | --- |
| Park Manager | Operations Dashboard, loaded in a WebView |
| Operations Officer | Operations Dashboard, loaded in a WebView |
| Ranger | Field app — offline incident capture (report → review → My Incidents) |
| Villager | Field app — conflict report (submit → pending/success → My Reports) |

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
| Park Manager | `manager@wildlife.demo` | `+94770000001` | Operations Dashboard |
| Operations Officer | `officer@wildlife.demo` | `+94770000002` | Operations Dashboard |
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