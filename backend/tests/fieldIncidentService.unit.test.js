// fieldIncidentService unit tests — the FieldIncident model and the
// display-ID counter are mocked so no database is needed. The real
// validateFieldIncident runs, so validation mapping is genuinely exercised.
jest.mock('../models/FieldIncident');
jest.mock('../utils/fieldIncidentDisplayId');

const fs = require('fs');
const FieldIncident = require('../models/FieldIncident');
const { nextFieldIncidentDisplayId } = require('../utils/fieldIncidentDisplayId');
const service = require('../services/fieldIncidentService');

let uuidCounter = 1000;
function uuid() {
  uuidCounter += 1;
  return `123e4567-e89b-12d3-a456-${uuidCounter.toString(16).padStart(12, '0')}`;
}

function validBody(overrides = {}) {
  return {
    reportId: uuid(),
    incidentType: 'snare_illegal_hunting',
    description: 'Illegal wire snare found near the game trail.',
    latitude: -1.292345,
    longitude: 36.821456,
    locationSource: 'gps',
    accuracy: 8,
    capturedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    ...overrides
  };
}

function storedDoc(overrides = {}) {
  return {
    reportId: uuid(),
    displayId: 'FI-2026-0001',
    incidentType: 'snare_illegal_hunting',
    description: 'Illegal wire snare found near the game trail.',
    location: { type: 'Point', coordinates: [36.821456, -1.292345], source: 'gps', accuracy: 8 },
    capturedAt: new Date(),
    receivedAt: new Date(),
    photo: null,
    reporter: null,
    patrolId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function mockUnlink() {
  return jest.spyOn(fs, 'unlink').mockImplementation((_path, cb) => cb && cb(null));
}

beforeEach(() => {
  jest.clearAllMocks();
  nextFieldIncidentDisplayId.mockResolvedValue('FI-2026-0001');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('registerFieldIncident (service, mocked model)', () => {
  test('duplicate reportId returns the stored report without creating', async () => {
    const existing = storedDoc();
    FieldIncident.findOne.mockResolvedValue(existing);

    const result = await service.registerFieldIncident({
      body: validBody({ reportId: existing.reportId })
    });

    expect(result.status).toBe(200);
    expect(result.payload.alreadySynced).toBe(true);
    expect(result.payload.displayId).toBe(existing.displayId);
    expect(FieldIncident.create).not.toHaveBeenCalled();
    expect(nextFieldIncidentDisplayId).not.toHaveBeenCalled();
  });

  test('race on duplicate key returns the winner instead of duplicating', async () => {
    const winner = storedDoc();
    FieldIncident.findOne
      .mockResolvedValueOnce(null) // idempotency check: nobody there yet
      .mockResolvedValueOnce(winner); // race loser: winner is now stored
    const race = new Error('E11000 duplicate key');
    race.code = 11000;
    FieldIncident.create.mockRejectedValueOnce(race);

    const result = await service.registerFieldIncident({ body: validBody() });

    expect(result.status).toBe(200);
    expect(result.payload.alreadySynced).toBe(true);
    expect(result.payload.reportId).toBe(winner.reportId);
  });

  test('race with no winner rethrows and cleans the uploaded photo', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    const race = new Error('E11000 duplicate key');
    race.code = 11000;
    FieldIncident.create.mockRejectedValueOnce(race);
    const unlink = mockUnlink();

    await expect(
      service.registerFieldIncident({ body: validBody(), uploadedPath: '/tmp/up.jpg' })
    ).rejects.toThrow('E11000 duplicate key');
    expect(unlink).toHaveBeenCalledWith('/tmp/up.jpg', expect.any(Function));
  });

  test('validation failure returns 400 and cleans the uploaded photo', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    const unlink = mockUnlink();

    const result = await service.registerFieldIncident({
      body: { reportId: uuid() }, // missing type/description/location/time
      uploadedPath: '/tmp/stale.jpg'
    });

    expect(result.status).toBe(400);
    expect(result.payload.message).toBe('Validation failed');
    expect(result.payload.errors.find((e) => e.field === 'incidentType')).toBeDefined();
    expect(FieldIncident.create).not.toHaveBeenCalled();
    expect(unlink).toHaveBeenCalledWith('/tmp/stale.jpg', expect.any(Function));
  });

  test.each([
    ['wrong MIME type', { path: '/u/x.pdf', mimeType: 'application/pdf', size: 10 }, 415],
    ['oversize photo', { path: '/u/b.jpg', mimeType: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }, 413]
  ])('photo %s maps to %i', async (_label, photo, status) => {
    FieldIncident.findOne.mockResolvedValue(null);
    const result = await service.registerFieldIncident({ body: validBody({ photo }) });
    expect(result.status).toBe(status);
    expect(FieldIncident.create).not.toHaveBeenCalled();
  });

  test('stores a valid report with displayId, reporter and receivedAt', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockImplementation(async (doc) => ({ ...doc }));
    const unlink = mockUnlink();
    const body = validBody();

    const result = await service.registerFieldIncident({ body, reporter: 'ranger-1' });

    expect(result.status).toBe(201);
    expect(result.payload.reportId).toBe(body.reportId);
    expect(result.payload.displayId).toBe('FI-2026-0001');
    expect(FieldIncident.create).toHaveBeenCalledWith(
      expect.objectContaining({ reporter: 'ranger-1', displayId: 'FI-2026-0001' })
    );
    expect(result.payload.receivedAt).toBeDefined();
    expect(unlink).not.toHaveBeenCalled();
  });

  test('database crash on create rethrows after cleanup', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockRejectedValueOnce(new Error('disk on fire'));
    const unlink = mockUnlink();

    await expect(
      service.registerFieldIncident({ body: validBody(), uploadedPath: '/tmp/crash.jpg' })
    ).rejects.toThrow('disk on fire');
    expect(unlink).toHaveBeenCalledWith('/tmp/crash.jpg', expect.any(Function));
  });

  test('removeUploadedFile ignores a missing path without touching fs', () => {
    const unlink = mockUnlink();
    service.removeUploadedFile(null);
    service.removeUploadedFile(undefined);
    expect(unlink).not.toHaveBeenCalled();
  });
});

describe('toPublicReport / statusForValidationErrors', () => {
  test('null photo when none stored; unwraps mongoose documents', () => {
    const doc = { ...storedDoc(), toObject() { return { ...this }; } };
    expect(service.toPublicReport(doc).photo).toBeNull();
    expect(service.toPublicReport(null)).toBeNull();
  });

  test('passes through a stored photo with a path', () => {
    const photo = { path: '/uploads/a.jpg', mimeType: 'image/jpeg', size: 10 };
    expect(service.toPublicReport(storedDoc({ photo })).photo).toEqual(photo);
  });

  test('maps photo errors to 415/413 and everything else to 400', () => {
    expect(
      service.statusForValidationErrors([{ field: 'photo', message: 'Only JPEG or PNG allowed' }])
    ).toBe(415);
    expect(
      service.statusForValidationErrors([{ field: 'photo', message: 'Photo exceeds the 5 MB limit' }])
    ).toBe(413);
    expect(service.statusForValidationErrors([{ field: 'description', message: 'x' }])).toBe(400);
  });
});

describe('syncReports (batch orchestration)', () => {
  test('keeps successes and flags missing reportId without aborting', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockImplementation(async (doc) => storedDoc({ ...doc }));
    const results = await service.syncReports(
      [{ incidentType: 'footprints' }, validBody({ incidentType: 'footprints' })],
      'ranger-1'
    );
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(false);
    expect(results[0].errors[0].field).toBe('reportId');
    expect(results[1].ok).toBe(true);
    expect(results[1].displayId).toMatch(/^FI-/);
  });

  test('records per-item storage crashes as failures', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockRejectedValueOnce(new Error('db down'));
    const item = validBody();
    const results = await service.syncReports([item], null);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ reportId: item.reportId, ok: false, message: 'db down' });
  });

  test('marks already-synced retries without duplicating', async () => {
    const existing = storedDoc();
    FieldIncident.findOne.mockResolvedValue(existing);
    const results = await service.syncReports([validBody({ reportId: existing.reportId })], null);
    expect(results[0].ok).toBe(true);
    expect(results[0].alreadySynced).toBe(true);
    expect(FieldIncident.create).not.toHaveBeenCalled();
  });

  test('batch limit constant stays at 100 per sync', () => {
    expect(service.SYNC_BATCH_LIMIT).toBe(100);
  });
});
