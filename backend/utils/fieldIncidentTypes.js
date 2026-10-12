// Shared FieldIncident constants (F1: Log Field Incident Offline).
//
// Single source of truth for the four backend incident type values, imported
// by both models/FieldIncident.js and utils/validateFieldIncident.js so the
// two can never drift apart. These are the SERVER values from the backend
// development plan and intentionally differ from the mobile F1 draft values
// ('snare' | 'poacher' | 'elephant' | 'crop') — the F3 sync feature owns any
// remapping between the two.
const FIELD_INCIDENT_TYPES = [
  'snare_illegal_hunting',
  'animal_carcass',
  'footprints',
  'illegal_campsite'
];

// Allowed `location.source` values for FieldIncident GeoJSON points.
const FIELD_INCIDENT_LOCATION_SOURCES = ['gps', 'manual'];

// Description rule: required, 1-500 characters after trimming.
const FIELD_INCIDENT_MAX_DESCRIPTION = 500;

// Photo rule: required, JPEG or PNG only, up to 5 MB.
// (Deliberately stricter than utils/upload.js, which also accepts WebP.)
const FIELD_INCIDENT_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const FIELD_INCIDENT_ALLOWED_PHOTO_MIMETYPES = ['image/jpeg', 'image/png'];

// capturedAt rule: valid date, not more than this far in the future
// (clock-skew tolerance between the ranger device and the server).
const FIELD_INCIDENT_CAPTURE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

module.exports = {
  FIELD_INCIDENT_TYPES,
  FIELD_INCIDENT_LOCATION_SOURCES,
  FIELD_INCIDENT_MAX_DESCRIPTION,
  FIELD_INCIDENT_MAX_PHOTO_BYTES,
  FIELD_INCIDENT_ALLOWED_PHOTO_MIMETYPES,
  FIELD_INCIDENT_CAPTURE_FUTURE_TOLERANCE_MS
};
