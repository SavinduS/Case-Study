const ConflictReport = require('../models/ConflictReport');
const { isValidLngLat } = require('./geo');

const INCIDENT_TYPES = ConflictReport.INCIDENT_TYPES;
const MAX_DESCRIPTION = 500;

// Evaluation doc E1 + §12 data table. Pure function, unit tested.
// Returns { ok, errors, value } — value is the normalized report payload.
function validateConflictReport(input = {}, { method = 'app' } = {}) {
  const errors = {};
  const value = {};

  if (!input.incidentType) {
    errors.incidentType = 'Incident type is required';
  } else if (!INCIDENT_TYPES.includes(input.incidentType)) {
    errors.incidentType = `Incident type must be one of: ${INCIDENT_TYPES.join(', ')}`;
  } else {
    value.incidentType = input.incidentType;
  }

  const coords = input.location && input.location.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) {
    errors.location = 'Location with latitude and longitude is required';
  } else {
    const [lng, lat] = coords.map(Number);
    if (!isValidLngLat(lng, lat)) {
      errors.location = 'Location coordinates are out of range';
    } else {
      value.location = { type: 'Point', coordinates: [lng, lat] };
    }
  }

  if (input.description !== undefined && input.description !== null && input.description !== '') {
    if (typeof input.description !== 'string' || input.description.length > MAX_DESCRIPTION) {
      errors.description = `Description must be a string of at most ${MAX_DESCRIPTION} characters`;
    } else {
      value.description = input.description.trim();
    }
  }

  if (input.accuracyMeters !== undefined && input.accuracyMeters !== null && input.accuracyMeters !== '') {
    const acc = Number(input.accuracyMeters);
    if (!Number.isFinite(acc) || acc < 0) {
      errors.accuracyMeters = 'Accuracy must be a non-negative number';
    } else {
      value.accuracyMeters = acc;
    }
  }

  if (input.locationText !== undefined && input.locationText !== null && input.locationText !== '') {
    if (typeof input.locationText !== 'string') {
      errors.locationText = 'Location text must be a string';
    } else {
      value.locationText = input.locationText.trim();
    }
  }

  if (input.photoUrl !== undefined && input.photoUrl !== null && input.photoUrl !== '') {
    if (typeof input.photoUrl !== 'string') {
      errors.photoUrl = 'Photo URL must be a string';
    } else {
      value.photoUrl = input.photoUrl;
    }
  }

  const contact = input.reporterContact;
  if (method === 'sms') {
    if (!contact || String(contact).replace(/\D/g, '').length < 7) {
      errors.reporterContact = 'A valid sender phone number is required for SMS reports';
    } else {
      value.reporterContact = String(contact).trim();
    }
  } else if (contact !== undefined && contact !== null && contact !== '') {
    if (String(contact).replace(/\D/g, '').length < 7) {
      errors.reporterContact = 'Reporter contact must be a valid phone number';
    } else {
      value.reporterContact = String(contact).trim();
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateConflictReport, MAX_DESCRIPTION };
