# Plan: unit tests for mobile + backend, coverage > 80%

## Current state (measured)

**Backend** (`jest --coverage`, 38 tests passing): overall **84.7% stmts / 82.9% branch / 84.3% funcs / 85.2% lines** — already >80%, but weak spots to close:

| File | Stmts | Gap |
|---|---|---|
| `app.js` | 50% | 404 handler, error middleware, health headers |
| `incidentController.js` | 20% | create/mine endpoints (needs auth flow tests) |
| `middlewares/auth.js` | 65% | optionalAuth branches |
| `authController.js` | 81% | register validation branches, 409, login 401 |
| `conflictReportController.js` | 80% | SMS menu-reply recovery branches, list filters |

**Mobile** (`frontend/mobile`): **zero test infrastructure** — no jest, no test files. 23 source files (6 screens, 7 components, 3 services, 2 api modules, config, constants).

**Out of scope:** `frontend/web` (placeholder — other members' work).

## Branch
`test/unit-coverage` off current HEAD (`fix/screen-headers` — merge the stacked UI PRs first, or this PR stacks).

---

## Part 1 — Backend (close gaps + enforce threshold)

### 1a. New `backend/tests/app.test.js`
- `GET /nope` → 404 JSON message (error/404 handlers, app.js:18-29)
- `POST /api/conflict-reports` with malformed JSON → body-parser error → error middleware (app.js:44-45)
- `GET /health` → 200 + `Cache-Control: no-store`

### 1b. New `backend/tests/auth.api.test.js`
- register: 400 missing fields / short password / bad role; **409** duplicate phone; 201 success shape `{id, role, token}`
- login: 400 missing, **401** bad password/unknown phone, 200 success
- Protected routes (covers `middlewares/auth.js` + `incidentController.js`):
  - `GET /api/conflict-reports` no token → 401; **villager** token → 403; officer token → 200
  - `POST /api/incidents` with token → 201; `GET /api/incidents/mine` → own incidents only

### 1c. New `backend/tests/smsRecovery.api.test.js` (controller lines 208-252)
- menu-reply `2` with **pending-area queue entry** → report created, queue marked completed
- menu-reply `3` with **pending-type queue entry** → area-help reply
- menu-reply with **no queue** → menu + example reply
- unrecognized text → queue document created + menu reply
- `GET /api/conflict-reports` filters: `status`, `since` invalid → 400, `limit` capped at 200

### 1d. `backend/package.json` jest config
```json
"collectCoverageFrom": ["app.js", "controllers/**/*.js", "middlewares/**/*.js", "models/**/*.js", "routes/**/*.js", "utils/**/*.js", "config/**/*.js", "!**/node_modules/**"],
"coverageThreshold": { "global": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 } }
```
(excludes `server.js` — port-binding side effects)

### 1e. Verify
`npm test` → all green (38 existing + ~25 new) **and** coverage ≥80% every global metric; failing threshold = failing suite.

---

## Part 2 — Mobile (test infra from scratch)

### 2a. Install (SDK-57 compatible)
```
npx expo install jest-expo jest @types/jest
npm install --save-dev @testing-library/react-native
```
(add `react-test-renderer@19.2.3` only if peer-dep warnings require it)

### 2b. `frontend/mobile/package.json`
```json
"scripts": { "test": "jest --coverage" },
"jest": {
  "preset": "jest-expo",
  "testMatch": ["**/__tests__/**/*.test.{ts,tsx}"],
  "coverageThreshold": { "global": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 } }
}
```

### 2c. `frontend/mobile/jest.setup.ts`
Mocks for: `@react-native-async-storage/async-storage` (official mock), `expo-image-picker`, `expo-location`, `react-native-webview`, `@react-native-community/netinfo`, `expo-constants` (hostUri), global `fetch`.

### 2d. Test files (`src/**/__tests__/*.test.tsx`) — one focused file per module

**Services & api (pure logic — highest value):**
- `api/baseUrl.test.ts` — probe order (cache → 5000 → 5001), `probeServer` reachable/unreachable, `invalidateBaseUrl`
- `api/client.test.ts` — JSON Content-Type set / FormData skips it; `ApiError` payload; timeout → `NetworkError`; `uploadPhoto` appends `{name, type, bytes}` part; `pingServer`
- `services/sectors.test.ts` — `sectorLabel` inside/outside sectors
- `services/offlineQueue.test.ts` — enqueue → PENDING; flush success + idempotent clientRefId; photo-first ordering; network error keeps PENDING + lastError; `recordOnlineSuccess`
- `services/location.test.ts` — permission denied → error state (mocked expo-location)
- `config.test.ts` — candidate list from mocked `hostUri`

**Components (render + interaction):**
- `PrimaryButton` — press fires, loading spinner, disabled
- `StatusBanner` — three tones render title/message
- `ScreenHeader` — centred title, right slot rendered
- `TabBar` — three tabs, `onSelect` fires with id, active styling
- `IncidentTypePicker` — all 5 types, selection callback
- `LocationCard` — GPS states (located / detecting / error)
- `PhotoPicker` — take-photo & gallery call picker (mocked), attach/remove preview

**Screens (smoke + key behaviour):**
- `SubmitReportScreen` — validation errors on empty submit; happy-path submit payload
- `MyReportsScreen` — renders pending/received rows from mocked queue; refresh button
- `SmsGuideScreen` — hotline `011 234 5678`, all type/area codes shown
- `LocationPickerScreen` — WebView rendered with html (mocked), confirm passes fix
- `ReportSuccessScreen` / `ReportPendingScreen` — render id, onDone fires

### 2e. Verify & iterate
`npm test` in `frontend/mobile` → read coverage table → add targeted tests until **every global metric ≥80%** (threshold enforces it).

---

## Commits (on `test/unit-coverage`)
1. `test(backend): cover auth, incidents, SMS recovery and app error paths, enforce 80% threshold`
2. `test(mobile): jest-expo setup with unit tests for api, services, components and screens`

## Notes
- Backend tests run against the Atlas `wildlife_test` DB (existing pattern, `setupFiles: tests/setupEnv.js`) — unchanged
- Mobile tests are pure Jest/jsdom — no device or emulator needed
- Both suites runnable by the evaluators with `npm test` in each folder
