// Stable UUID v4 reportId for Log Field Incident Offline.
//
// The backend (`backend/utils/validateFieldIncident.js`) requires reportId to
// be a UUID and uses it for idempotency: repeated submissions with the same
// reportId never create duplicate records. The id is generated once when the
// report is first saved offline and then preserved across edits, restarts and
// retries (see services/incidentStorage.ts).
//
// No extra dependency: uses `crypto.randomUUID` when available (modern
// runtimes) with a `Math.random` v4 fallback so unit tests and older devices
// keep working.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function randomFallback(): string {
  const rand = (n: number): string => {
    let out = '';
    for (let i = 0; i < n; i += 1) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  };
  // 4xxx (version 4) and 8/9/a/b (variant) nibbles keep the shape valid.
  const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
  return `${rand(8)}-${rand(4)}-4${rand(3)}-${variant}${rand(3)}-${rand(12)}`;
}

/** Generate a new UUID v4 reportId. */
export function newReportId(): string {
  try {
    const g = globalThis as { crypto?: { randomUUID?: () => string } };
    if (g.crypto && typeof g.crypto.randomUUID === 'function') {
      return g.crypto.randomUUID();
    }
  } catch {
    // fall through to the Math.random implementation below
  }
  return randomFallback();
}

/** True when the value looks like a UUID the backend will accept. */
export function isValidReportId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}
