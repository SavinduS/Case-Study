import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DESCRIPTION_LENGTH } from '../constants/fieldIncident.ts';
import {
  toValidatedFieldIncident,
  validateFieldIncident
} from '../services/validateFieldIncident.ts';
import type { FieldIncidentDraft } from '../fieldIncidentTypes.ts';

function baseDraft(): FieldIncidentDraft {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare',
    description: 'Illegal wire snare found near the game trail. No animals caught.',
    location: {
      coordinates: [36.821456, -1.292345],
      accuracyMeters: 8,
      manual: false
    },
    photoUri: null
  };
}

describe('validateFieldIncident (F1 capture form)', () => {
  it('accepts a complete draft', () => {
    assert.deepEqual(validateFieldIncident(baseDraft()), {});
  });

  it('requires an incident type', () => {
    const errors = validateFieldIncident({ ...baseDraft(), incidentType: null });
    assert.equal(errors.incidentType, 'Select the type of incident.');
    assert.equal(errors.description, undefined);
    assert.equal(errors.location, undefined);
  });

  it('requires a non-blank description', () => {
    for (const description of ['', '   ', '\n\t ']) {
      const errors = validateFieldIncident({ ...baseDraft(), description });
      assert.equal(errors.description, 'Enter a short description of what you found.');
    }
  });

  it('rejects descriptions longer than 500 characters', () => {
    const description = 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    const errors = validateFieldIncident({ ...baseDraft(), description });
    assert.match(errors.description ?? '', /within 500 characters/);
  });

  it('accepts a description of exactly 500 characters', () => {
    const description = 'y'.repeat(MAX_DESCRIPTION_LENGTH);
    assert.deepEqual(validateFieldIncident({ ...baseDraft(), description }), {});
  });

  it('requires a location', () => {
    const errors = validateFieldIncident({ ...baseDraft(), location: null });
    assert.equal(errors.location, 'Location is required. Retry GPS or set it on the map.');
  });

  it('reports every missing field at once', () => {
    const errors = validateFieldIncident({
      ...baseDraft(),
      incidentType: null,
      description: '  ',
      location: null
    });
    assert.equal(Object.keys(errors).length, 3);
  });

  it('photo is optional', () => {
    assert.deepEqual(validateFieldIncident(baseDraft()), {});
    assert.deepEqual(
      validateFieldIncident({ ...baseDraft(), photoUri: 'file:///photo.jpg' }),
      {}
    );
  });

  it('toValidatedFieldIncident trims the description', () => {
    const result = toValidatedFieldIncident({
      ...baseDraft(),
      description: '  snare near trail  '
    });
    assert.equal(result?.description, 'snare near trail');
  });

  it('toValidatedFieldIncident returns null when invalid', () => {
    assert.equal(
      toValidatedFieldIncident({ ...baseDraft(), incidentType: null }),
      null
    );
    assert.equal(toValidatedFieldIncident({ ...baseDraft(), location: null }), null);
  });
});