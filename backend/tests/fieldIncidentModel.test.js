// F1 model tests — schema-only via validateSync, no database needed.
const mongoose = require('mongoose');
const FieldIncident = require('../models/FieldIncident');
const { FIELD_INCIDENT_TYPES } = require('../utils/fieldIncidentTypes');

function validDoc(overrides = {}) {
  return {
    reportId: '123e4567-e89b-12d3-a456-426614174000',
    incidentType: 'footprints',
    description: 'Fresh footprints heading toward the riverbed.',
    location: { coordinates: [36.821456, -1.292345], source: 'manual', accuracy: 12 },
    capturedAt: new Date(Date.now() - 5000),
    photo: { path: '/uploads/print.jpg', mimeType: 'image/jpeg', size: 512 },
    reporter: new mongoose.Types.ObjectId(),
    ...overrides
  };
}

describe('FieldIncident model (F1)', () => {
  test('accepts a complete document', () => {
    const err = new FieldIncident(validDoc()).validateSync();
    expect(err).toBeUndefined();
  });

  test('shares the exact incident type values with the validator constants', () => {
    expect(FieldIncident.schema.path('incidentType').options.enum).toEqual(
      FIELD_INCIDENT_TYPES
    );
    expect(FIELD_INCIDENT_TYPES).toEqual([
      'snare_illegal_hunting',
      'animal_carcass',
      'footprints',
      'illegal_campsite'
    ]);
  });

  test('reportId has a unique index for idempotent retries', () => {
    expect(FieldIncident.schema.path('reportId').options.unique).toBe(true);
  });

  test('reporter references the User model', () => {
    expect(FieldIncident.schema.path('reporter').options.ref).toBe('User');
  });

  test('requires reportId, description, coordinates, capturedAt and photo', () => {
    const doc = new FieldIncident({
      incidentType: 'animal_carcass',
      location: { coordinates: [] },
      photo: {}
    });
    const err = doc.validateSync();
    expect(err.errors.reportId).toBeDefined();
    expect(err.errors.description).toBeDefined();
    expect(err.errors.capturedAt).toBeDefined();
    expect(err.errors['photo.path']).toBeDefined();
    expect(err.errors['photo.mimeType']).toBeDefined();
  });

  test('rejects descriptions longer than 500 characters', () => {
    const err = new FieldIncident(validDoc({ description: 'x'.repeat(501) })).validateSync();
    expect(err.errors.description).toBeDefined();
  });

  test('patrolId is optional', () => {
    expect(new FieldIncident(validDoc()).validateSync()).toBeUndefined();
    const withPatrol = new FieldIncident(validDoc({ patrolId: 'patrol-9' })).validateSync();
    expect(withPatrol).toBeUndefined();
  });
});
