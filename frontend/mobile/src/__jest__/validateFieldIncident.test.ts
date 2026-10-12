import { MAX_DESCRIPTION_LENGTH } from '../constants/fieldIncident';
import type { FieldIncidentDraft } from '../fieldIncidentTypes';
import {
  toValidatedFieldIncident,
  validateFieldIncident
} from '../services/validateFieldIncident';

function baseDraft(): FieldIncidentDraft {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare',
    description: 'Illegal wire snare found near the game trail. No animals caught.',
    location: { coordinates: [36.821456, -1.292345], accuracyMeters: 8, manual: false },
    photoUri: null
  };
}

describe('validateFieldIncident (mobile)', () => {
  it('accepts a complete valid draft', () => {
    expect(validateFieldIncident(baseDraft())).toEqual({});
  });

  it('accepts every incident type', () => {
    for (const incidentType of ['snare', 'poacher', 'elephant', 'crop'] as const) {
      expect(validateFieldIncident({ ...baseDraft(), incidentType })).toEqual({});
    }
  });

  it('requires an incident type', () => {
    const errors = validateFieldIncident({ ...baseDraft(), incidentType: null });
    expect(errors.incidentType).toBe('Select the type of incident.');
    expect(errors.description).toBeUndefined();
    expect(errors.location).toBeUndefined();
  });

  it('requires a non-blank description', () => {
    for (const description of ['', '   ', '\n\t ', '     \n  ']) {
      const errors = validateFieldIncident({ ...baseDraft(), description });
      expect(errors.description).toBe('Enter a short description of what you found.');
    }
  });

  it('rejects whitespace-only description', () => {
    expect(validateFieldIncident({ ...baseDraft(), description: '   ' }).description).toMatch(
      /Enter a short description/
    );
  });

  it('rejects descriptions longer than MAX (>=500 chars)', () => {
    const over = 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    const errors = validateFieldIncident({ ...baseDraft(), description: over });
    expect(errors.description).toMatch(/within 500 characters/);
    expect(errors.description).toMatch(new RegExp(String(over.length)));
  });

  it('rejects far-over-limit descriptions (600 chars)', () => {
    const description = 'z'.repeat(600);
    const errors = validateFieldIncident({ ...baseDraft(), description });
    expect(errors.description).toBeDefined();
  });

  it('accepts a description of exactly MAX characters', () => {
    const description = 'y'.repeat(MAX_DESCRIPTION_LENGTH);
    expect(validateFieldIncident({ ...baseDraft(), description })).toEqual({});
  });

  it('accepts a description one char under the limit', () => {
    expect(
      validateFieldIncident({ ...baseDraft(), description: 'a'.repeat(MAX_DESCRIPTION_LENGTH - 1) })
    ).toEqual({});
  });

  it('requires a location', () => {
    const errors = validateFieldIncident({ ...baseDraft(), location: null });
    expect(errors.location).toBe('Location is required. Retry GPS or set it on the map.');
  });

  it('reports every missing field at once', () => {
    const errors = validateFieldIncident({
      ...baseDraft(),
      incidentType: null,
      description: '  ',
      location: null
    });
    expect(Object.keys(errors)).toHaveLength(3);
    expect(errors.incidentType).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.location).toBeDefined();
  });

  it('photo is optional (null or uri)', () => {
    expect(validateFieldIncident(baseDraft())).toEqual({});
    expect(validateFieldIncident({ ...baseDraft(), photoUri: 'file:///photo.jpg' })).toEqual({});
  });

  it('toValidatedFieldIncident trims the description and preserves fields', () => {
    const result = toValidatedFieldIncident({ ...baseDraft(), description: '  snare near trail  ' });
    expect(result).not.toBeNull();
    expect(result?.description).toBe('snare near trail');
    expect(result?.incidentType).toBe('snare');
    expect(result?.location?.coordinates).toEqual([36.821456, -1.292345]);
    expect(result?.capturedAt).toBe(baseDraft().capturedAt);
  });

  it('toValidatedFieldIncident keeps photoUri', () => {
    const result = toValidatedFieldIncident({ ...baseDraft(), photoUri: 'file:///a.jpg' });
    expect(result?.photoUri).toBe('file:///a.jpg');
  });

  it('toValidatedFieldIncident returns null when invalid', () => {
    expect(toValidatedFieldIncident({ ...baseDraft(), incidentType: null })).toBeNull();
    expect(toValidatedFieldIncident({ ...baseDraft(), location: null })).toBeNull();
    expect(toValidatedFieldIncident({ ...baseDraft(), description: '   ' })).toBeNull();
    expect(
      toValidatedFieldIncident({ ...baseDraft(), description: 'x'.repeat(501) })
    ).toBeNull();
  });
});

