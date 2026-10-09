const { isValidLngLat } = require('./geo');
const {
  FIELD_INCIDENT_TYPES,
  FIELD_INCIDENT_LOCATION_SOURCES,
  FIELD_INCIDENT_MAX_DESCRIPTION,
  FIELD_INCIDENT_MAX_PHOTO_BYTES,
  FIELD_INCIDENT_ALLOWED_PHOTO_MIMETYPES,
  FIELD_INCIDENT_CAPTURE_FUTURE_TOLERANCE_MS
} = require('./fieldIncidentTypes');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// F1: Log Field Incident Offline — server-side repeat of the mobile
// validateIncident rules (the server never trusts the client). Pure function,
// unit tested. Returns { ok, errors, value } where errors follows the API
// contract { errors: [{ field, message }] } so the app can highlight fields
// (use-case Exception Flow 1), and value is the normalized payload for F2.
//
// Accepted input shape (multipart fields arrive as strings, so numeric/date
// values are coerced):
//   { reportId, incidentType, description, latitude, longitude,
//     locationSource?, accuracy?, capturedAt, photo?, patrolId? }
// Coordinates may alternatively be given as location: { coordinates: [lng, lat] }.
// The photo may be passed as `photo` (stored record shape
// { path, mimeType, size }) or as `file` (multer shape
// { path, mimetype, size }), or via options.file.
function validateFieldIncident(input = {}, options = {}) {
  const errors = [];
  const value = {};
  const push = (field, message) => errors.push({ field, message });

  // reportId: present, valid UUID (identifies retry attempts, F3)
  const rawReportId = input.reportId;
  if (rawReportId === undefined || rawReportId === null || String(rawReportId).trim() === '') {
    push('reportId', 'reportId is required');
  } else if (!UUID_RE.test(String(rawReportId).trim())) {
    push('reportId', 'reportId must be a valid UUID');
  } else {
    value.reportId = String(rawReportId).trim();
  }

  // incidentType: exactly one of the four shared values
  if (!FIELD_INCIDENT_TYPES.includes(input.incidentType)) {
    push('incidentType', 'Unknown incident type');
  } else {
    value.incidentType = input.incidentType;
  }

  // description: required, 1-500 characters after trimming
  if (typeof input.description !== 'string' || input.description.trim().length === 0) {
    push('description', 'Description is required');
  } else if (input.description.trim().length > FIELD_INCIDENT_MAX_DESCRIPTION) {
    push('description', 'Description is too long');
  } else {
    value.description = input.description.trim();
  }

  // location: numeric coordinates in range (via utils/geo.js), source gps/manual.
  // Coordinates may be given as location: { coordinates: [lng, lat] } (JSON
  // body) or as flat latitude/longitude fields (multipart form). When the
  // location object carries coordinates it owns the fix, so its nested
  // source/accuracy win over the flat fallbacks.
  let lng = Number.NaN;
  let lat = Number.NaN;
  let nestedSource;
  let nestedAccuracy;
  const coords = input.location && input.location.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    [lng, lat] = coords.map(Number);
    nestedSource = input.location.source;
    nestedAccuracy = input.location.accuracy;
  } else {
    if (input.longitude !== undefined && input.longitude !== null && input.longitude !== '') {
      lng = Number(input.longitude);
    }
    if (input.latitude !== undefined && input.latitude !== null && input.latitude !== '') {
      lat = Number(input.latitude);
    }
  }
  const rawSource = nestedSource ?? input.locationSource ?? input.source ?? 'gps';
  const source = String(rawSource).toLowerCase();
  const rawAccuracy = nestedAccuracy ?? input.accuracy ?? input.accuracyMeters;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !isValidLngLat(lng, lat)) {
    push('location', 'Invalid location');
  } else if (!FIELD_INCIDENT_LOCATION_SOURCES.includes(source)) {
    push('location', 'Invalid location');
  } else if (
    rawAccuracy !== undefined && rawAccuracy !== null && rawAccuracy !== ''
    && (!Number.isFinite(Number(rawAccuracy)) || Number(rawAccuracy) < 0)
  ) {
    push('location', 'Invalid location');
  } else {
    value.location = { type: 'Point', coordinates: [lng, lat], source };
    if (rawAccuracy !== undefined && rawAccuracy !== null && rawAccuracy !== '') {
      value.location.accuracy = Number(rawAccuracy);
    }
  }

  // capturedAt: valid date, not more than a few minutes in the future
  const capturedAt = input.capturedAt === undefined || input.capturedAt === null
    ? null
    : new Date(input.capturedAt);
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
    push('capturedAt', 'Invalid capture time');
  } else if (capturedAt.getTime() - Date.now() > FIELD_INCIDENT_CAPTURE_FUTURE_TOLERANCE_MS) {
    push('capturedAt', 'Invalid capture time');
  } else {
    value.capturedAt = capturedAt;
  }

  // photo: required, JPEG or PNG, up to 5 MB (mirrors utils/upload.js
  // conventions: 415 wrong type, 413 too large — mapped by the F2 route)
  const photo = input.photo || input.file || options.file || null;
  if (!photo) {
    push('photo', 'Photo is required');
  } else {
    const mimeType = photo.mimeType ?? photo.mimetype ?? photo.type;
    const size = photo.size !== undefined && photo.size !== null && photo.size !== ''
      ? Number(photo.size)
      : Number.NaN;
    if (!FIELD_INCIDENT_ALLOWED_PHOTO_MIMETYPES.includes(mimeType)) {
      push('photo', 'Unsupported photo type. Only JPEG or PNG photos are supported');
    } else if (!Number.isFinite(size) || size <= 0) {
      push('photo', 'Photo is required');
    } else if (size > FIELD_INCIDENT_MAX_PHOTO_BYTES) {
      push('photo', 'Photo exceeds the 5 MB limit');
    } else {
      value.photo = { path: photo.path, mimeType, size };
    }
  }

  // patrolId: optional free-form link to the patrol session
  if (input.patrolId !== undefined && input.patrolId !== null && String(input.patrolId).trim() !== '') {
    value.patrolId = String(input.patrolId).trim();
  }

  return { ok: errors.length === 0, errors, value };
}

module.exports = { validateFieldIncident };
