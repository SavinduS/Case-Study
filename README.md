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

```bash
# 1. API (reads MONGODB_URI from backend/.env)
cd backend
npm install
npm run seed          # park, geofences, collars, ranger teams
npm run dev           # http://localhost:5055

# 2. Dashboard
cd ../frontend/web
npm install
npm run dev           # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:5055`, so the browser stays on one
origin and no API base URL is baked into the bundle.

Useful commands:

| Command | Effect |
| --- | --- |
| `npm run seed` | Upsert reference data (safe to re-run) |
| `npm run seed:reset` | Clear alerts/audit/dispatches and restore collar positions |
| `TELEMETRY_SIMULATOR=false npm run dev` | Stop the server generating collar telemetry |

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
  layout/                      Topbar + module rail
  components/ui/               Button, Badge, Modal, ModulePlaceholder
  pages/PortalModuleRoute.jsx  Placeholder route for other members' modules
  services/api.js              All HTTP calls
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