const { validateFieldIncident } = require('../utils/validateFieldIncident');
const {
  FIELD_INCIDENT_TYPES,
  FIELD_INCIDENT_MAX_DESCRIPTION,
  FIELD_INCIDENT_MAX_PHOTO_BYTES
} = require('../utils/fieldIncidentTypes');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function validPayload(overrides = {}) {
  return {
    reportId: VALID_UUID,
    incidentType: 'snare_illegal_hunting',
    description: 'Illegal wire snare found near the game trail. No animals caught.',
    latitude: -1.292345,
    longitude: 36.821456,
    locationSource: 'gps',
    accuracy: 8,
    capturedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    photo: { path: '/uploads/photo-1.jpg', mimeType: 'image/jpeg', size: 1024 },
    ...overrides
  };
}

function fields(result) {
  return result.errors.map((e) => e.field);
}

describe('validateFieldIncident (F1)', () => {
  test('accepts a valid incident payload and normalizes it', () => {
    const result = validateFieldIncident(validPayload({ description: '  snare near trail  ' }));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value.reportId).toBe(VALID_UUID);
    expect(result.value.incidentType).toBe('snare_illegal_hunting');
    expect(result.value.description).toBe('snare near trail');
    expect(result.value.location).toEqual({
      type: 'Point',
      coordinates: [36.821456, -1.292345],
      source: 'gps',
      accuracy: 8
    });
    expect(result.value.capturedAt).toBeInstanceOf(Date);
    expect(result.value.photo).toEqual({
      path: '/uploads/photo-1.jpg',
      mimeType: 'image/jpeg',
      size: 1024
    });
  });

  test('accepts every supported incident type', () => {
    for (const incidentType of FIELD_INCIDENT_TYPES) {
      const result = validateFieldIncident(validPayload({ incidentType }));
      expect(result.ok).toBe(true);
    }
    expect(FIELD_INCIDENT_TYPES).toEqual([
      'snare_illegal_hunting',
      'animal_carcass',
      'footprints',
      'illegal_campsite'
    ]);
  });

  test('errors follow the { errors: [{ field, message }] } contract', () => {
    const result = validateFieldIncident({});
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
    for (const err of result.errors) {
      expect(typeof err.field).toBe('string');
      expect(typeof err.message).toBe('string');
    }
  });

  describe('reportId', () => {
    test('rejects a missing reportId', () => {
      const { reportId: _dropped, ...rest } = validPayload();
      const result = validateFieldIncident(rest);
      expect(result.ok).toBe(false);
      expect(fields(result)).toContain('reportId');
      expect(result.errors.find((e) => e.field === 'reportId').message).toBe(
        'reportId is required'
      );
    });

    test.each([['empty string', '   '], ['null', null]])(
      'rejects %s reportId',
      (_label, reportId) => {
        const result = validateFieldIncident(validPayload({ reportId }));
        expect(result.ok).toBe(false);
        expect(fields(result)).toContain('reportId');
        expect(result.errors.find((e) => e.field === 'reportId').message).toBe('reportId is required');
      }
    );

    test.each([['not-a-uuid'], ['12345'], ['zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz']])(
      'rejects invalid reportId %s',
      (reportId) => {
        const result = validateFieldIncident(validPayload({ reportId }));
        expect(result.ok).toBe(false);
        expect(result.errors.find((e) => e.field === 'reportId').message).toBe(
          'reportId must be a valid UUID'
        );
      }
    );
  });

  describe('incidentType', () => {
    test.each([
      ['missing', undefined],
      ['null', null],
      ['empty', ''],
      // frontend F1 draft values and legacy sample values are not backend values
      ['snare', 'snare'],
      ['poacher', 'poacher'],
      ['elephant', 'elephant'],
      ['crop', 'crop'],
      ['elephant_sighting', 'elephant_sighting'],
      ['SN ARE', 'SNARE_ILLEGAL_HUNTING']
    ])('rejects %s incident type', (_label, incidentType) => {
      const result = validateFieldIncident(validPayload({ incidentType }));
      expect(result.ok).toBe(false);
      expect(result.errors.find((e) => e.field === 'incidentType').message).toBe(
        'Unknown incident type'
      );
    });
  });

  describe('description', () => {
    test.each([
      ['missing', undefined],
      ['empty', ''],
      ['blank', '   \n\t ']
    ])('rejects %s description', (_label, description) => {
      const result = validateFieldIncident(validPayload({ description }));
      expect(result.ok).toBe(false);
      expect(result.errors.find((e) => e.field === 'description').message).toBe(
        'Description is required'
      );
    });

    test('rejects a non-string description', () => {
      const result = validateFieldIncident(validPayload({ description: 42 }));
      expect(result.ok).toBe(false);
      expect(fields(result)).toContain('description');
    });

    test('accepts exactly 500 characters and rejects 501', () => {
      const ok = validateFieldIncident(
        validPayload({ description: 'a'.repeat(FIELD_INCIDENT_MAX_DESCRIPTION) })
      );
      expect(ok.ok).toBe(true);

      const tooLong = validateFieldIncident(
        validPayload({ description: 'a'.repeat(FIELD_INCIDENT_MAX_DESCRIPTION + 1) })
      );
      expect(tooLong.ok).toBe(false);
      expect(tooLong.errors.find((e) => e.field === 'description').message).toBe(
        'Description is too long'
      );
    });

    test('measures length after trimming', () => {
      const padded = validateFieldIncident(
        validPayload({ description: `  ${'b'.repeat(FIELD_INCIDENT_MAX_DESCRIPTION)}  ` })
      );
      expect(padded.ok).toBe(true);
      expect(padded.value.description).toHaveLength(FIELD_INCIDENT_MAX_DESCRIPTION);
    });
  });

  describe('location', () => {
    test.each([
      ['non-numeric strings', { latitude: 'north', longitude: 'east' }],
      ['missing latitude', { latitude: undefined, longitude: 36.8 }],
      ['missing longitude', { latitude: -1.29, longitude: undefined }],
      ['latitude above 90', { latitude: 90.0001, longitude: 36.8 }],
      ['latitude below -90', { latitude: -90.0001, longitude: 36.8 }],
      ['longitude above 180', { latitude: -1.29, longitude: 180.0001 }],
      ['longitude below -180', { latitude: -1.29, longitude: -180.0001 }],
      ['NaN', { latitude: NaN, longitude: NaN }]
    ])('rejects %s coordinates', (_label, coords) => {
      const result = validateFieldIncident(validPayload(coords));
      expect(result.ok).toBe(false);
      expect(result.errors.find((e) => e.field === 'location').message).toBe('Invalid location');
    });

    test.each([
      ['equator/prime meridian', 0, 0],
      ['north pole edge', 90, 0],
      ['south pole edge', -90, 0],
      ['antimeridian east', 0, 180],
      ['antimeridian west', 0, -180]
    ])('accepts boundary coordinates (%s)', (_label, latitude, longitude) => {
      const result = validateFieldIncident(validPayload({ latitude, longitude }));
      expect(result.ok).toBe(true);
      expect(result.value.location.coordinates).toEqual([longitude, latitude]);
    });

    test('accepts coordinates as location.coordinates in [lng, lat] order', () => {
      const base = validPayload({ latitude: undefined, longitude: undefined });
      const result = validateFieldIncident({
        ...base,
        location: { coordinates: [36.821456, -1.292345], source: 'manual' }
      });
      expect(result.ok).toBe(true);
      expect(result.value.location).toMatchObject({
        coordinates: [36.821456, -1.292345],
        source: 'manual'
      });
    });

    test('rejects out-of-range location.coordinates', () => {
      const base = validPayload({ latitude: undefined, longitude: undefined });
      const result = validateFieldIncident({
        ...base,
        location: { coordinates: [999, 999] }
      });
      expect(result.ok).toBe(false);
      expect(fields(result)).toContain('location');
    });

    test('rejects unknown location source and negative accuracy', () => {
      expect(fields(validateFieldIncident(validPayload({ locationSource: 'tower' })))).toContain(
        'location'
      );
      expect(fields(validateFieldIncident(validPayload({ accuracy: -3 })))).toContain('location');
    });

    test('defaults source to gps and keeps accuracy optional', () => {
      const { locationSource: _drop, accuracy: _dropAcc, ...rest } = validPayload();
      const result = validateFieldIncident(rest);
      expect(result.ok).toBe(true);
      expect(result.value.location.source).toBe('gps');
      expect(result.value.location.accuracy).toBeUndefined();
    });
  });

  describe('capturedAt', () => {
    test.each([
      ['missing', undefined],
      ['garbage string', 'not-a-date'],
      ['NaN date', new Date(NaN).toString()]
    ])('rejects %s capture time', (_label, capturedAt) => {
      const result = validateFieldIncident(validPayload({ capturedAt }));
      expect(result.ok).toBe(false);
      expect(result.errors.find((e) => e.field === 'capturedAt').message).toBe(
        'Invalid capture time'
      );
    });

    test('rejects timestamps more than a few minutes in the future', () => {
      const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const result = validateFieldIncident(validPayload({ capturedAt: future }));
      expect(result.ok).toBe(false);
      expect(fields(result)).toContain('capturedAt');
    });

    test('accepts past timestamps and small clock skew', () => {
      for (const capturedAt of [
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 60 * 1000).toISOString(),
        new Date()
      ]) {
        expect(validateFieldIncident(validPayload({ capturedAt })).ok).toBe(true);
      }
    });
  });

  describe('photo', () => {
    test('rejects a missing photo', () => {
      const { photo: _drop, ...rest } = validPayload();
      const result = validateFieldIncident(rest);
      expect(result.ok).toBe(false);
      expect(result.errors.find((e) => e.field === 'photo').message).toBe('Photo is required');
    });

    test.each([['PDF', 'application/pdf'], ['GIF', 'image/gif'], ['WebP', 'image/webp']])(
      'rejects wrong MIME type (%s)',
      (_label, mimeType) => {
        const result = validateFieldIncident(
          validPayload({ photo: { path: '/uploads/x', mimeType, size: 1024 } })
        );
        expect(result.ok).toBe(false);
        expect(result.errors.find((e) => e.field === 'photo').message).toMatch(/Only JPEG or PNG/);
      }
    );

    test('rejects a photo larger than 5 MB and accepts exactly 5 MB', () => {
      const tooBig = validateFieldIncident(
        validPayload({
          photo: {
            path: '/uploads/big.jpg',
            mimeType: 'image/jpeg',
            size: FIELD_INCIDENT_MAX_PHOTO_BYTES + 1
          }
        })
      );
      expect(tooBig.ok).toBe(false);
      expect(tooBig.errors.find((e) => e.field === 'photo').message).toBe(
        'Photo exceeds the 5 MB limit'
      );

      const exact = validateFieldIncident(
        validPayload({
          photo: {
            path: '/uploads/exact.png',
            mimeType: 'image/png',
            size: FIELD_INCIDENT_MAX_PHOTO_BYTES
          }
        })
      );
      expect(exact.ok).toBe(true);
    });

    test('accepts the multer file shape via options.file', () => {
      const { photo: _drop, ...rest } = validPayload();
      const result = validateFieldIncident(rest, {
        file: { path: '/uploads/m.jpg', mimetype: 'image/jpeg', size: 2048 }
      });
      expect(result.ok).toBe(true);
      expect(result.value.photo.mimeType).toBe('image/jpeg');
    });
  });

  test('keeps an optional patrolId and ignores a blank one', () => {
    expect(validateFieldIncident(validPayload({ patrolId: ' patrol-7 ' })).value.patrolId).toBe(
      'patrol-7'
    );
    expect(
      validateFieldIncident(validPayload({ patrolId: '   ' })).value.patrolId
    ).toBeUndefined();
  });
});
