# Smart Wildlife Conservation and Anti-Poaching Monitoring System
Group 033 | SE3070 Case Studies in Software Engineering

- `frontend/mobile` — React Native app (Villager conflict report + Ranger offline incident)
- `frontend/web` — Desktop browser dashboard (Officer alerts + Manager analytics)
- `backend` — Node + MongoDB API

## Manage Wildlife Collar Boundary Alerts

Use case implemented by HANAAN M F A S (IT23594586) as part of Assignment 02.
Covers the Operations Officer monitoring GPS collar telemetry, geofence breach
detection, critical alerting and ranger dispatch.

Run the dashboard:

```bash
cd frontend/web
npm install
npm run dev      # http://localhost:5173
```

### Where the code lives

```
src/
  layout/                      Topbar + module rail
  components/ui/               Button, Badge, Modal, ModulePlaceholder
  pages/PortalModuleRoute.jsx  Placeholder route for other members' modules
  features/collar-alerts/
    data/parkData.js           Park boundary, geofences, collars, rangers
    domain/geo.js              Haversine, point-in-polygon, distance-to-edge
    domain/geofenceEngine.js   evaluateGeofence / deriveSeverity / prioritiseAlerts
    domain/alertFactory.js     Alert + audit record construction
    domain/constants.js        Alert status, threat levels, response actions
    services/                  Mock telemetry gateway + notification service
    hooks/useCollarAlerts.js   Controller: ingest -> evaluate -> queue -> audit
    components/map/            Leaflet map, markers, legend, map chrome
    components/alerts/         Critical alert modal, queue, dialogs, drawer
    components/panels/         Collar registry + geofence register
    pages/DashboardPage.jsx    Screen composition
```

### Navigation

The module rail and top navigation are both live.

| Control | Behaviour |
| --- | --- |
| Rail: Tracked collars | Collar registry — status, device, battery, health, risk, last fix |
| Rail: Active alerts | Prioritised alert queue (default panel) |
| Rail: Geofences | Geofence register with per-zone show/hide on the map |
| Rail: Incidents, Patrols, Camera traps, Reports, Settings | Placeholder naming the owning member |
| Nav: Dashboard | This use case |
| Nav: Data Logs, Map View, Reports, Admin | Placeholder route naming the owning member |

### Use case coverage

| Flow | Where |
| --- | --- |
| Main flow: telemetry -> geofence -> alert -> dispatch -> audit | `hooks/useCollarAlerts.js`, `components/alerts/CriticalAlertModal.jsx` |
| A. Animal remains in safe zone | `domain/geofenceEngine.js` (`safe: true`, no alert) |
| B. Simultaneous breaches prioritised | `prioritiseAlerts` + `ActiveAlertsPanel.jsx` |
| C. Manual override / false alarm | `FalseAlarmDialog.jsx` |
| D. Offline delayed telemetry batch | `telemetryService.js` + `OperationsDrawer.jsx` |
| Exception 1. Telemetry connection failure | `SignalLostBanner.jsx` |
| Exception 2. Session expired | `SessionExpiredOverlay.jsx` |
| Exception 3. Dispatch failed after retries | `services/dispatchService.js` (3 retries) |

### Notes for the backend phase

- Coordinates are stored as GeoJSON-style `[lng, lat]` throughout. `components/map/leafletAdapter.js`
  is the single place that converts to Leaflet's `[lat, lng]`.
- `MockTelemetryGateway` (Observer) is replaced by an HTTP/SSE subscription; `NotificationService`
  by a POST to the dispatch endpoint. The reducer and domain layer need no changes.
- Threat escalation is monotonic: approaching -> inside -> deep inside, plus settlement proximity.
- A breach raises one alert per episode. Dismissed/resolved alerts suppress re-alerts for
  `FALSE_ALARM_SUPPRESSION_MS` so an officer is not handed the same false alarm on every fix.