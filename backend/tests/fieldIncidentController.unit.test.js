// Field-incident controller unit tests — the FieldIncident model and the
// display-ID counter are mocked so no database is needed. The real
// validateFieldIncident runs, so validation mapping is genuinely exercised.
jest.mock('../models/FieldIncident');
jest.mock('../utils/fieldIncidentDisplayId');
jest.mock('../utils/upload', () => ({
  upload: { single: jest.fn() },
  uploadDir: '/tmp/uploads',
  ALLOWED_TYPES: { 'image/jpeg': 'jpg', 'image/png': 'png' }
}));

const fs = require('fs');
const FieldIncident = require('../models/FieldIncident');
const { nextFieldIncidentDisplayId } = require('../utils/fieldIncidentDisplayId');
const { upload } = require('../utils/upload');
const {
  registerFieldIncident,
  createFieldIncident,
  syncFieldIncidents,
  myFieldIncidents,
  getFieldIncident,
  toPublicReport
} = require('../controllers/fieldIncidentController');

let uuidCounter = 0;
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

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  nextFieldIncidentDisplayId.mockResolvedValue('FI-2026-0001');
});

describe('registerFieldIncident (mocked model)', () => {
  test('returns the stored report with alreadySynced when the reportId exists', async () => {
    const existing = storedDoc();
    FieldIncident.findOne.mockResolvedValue(existing);

    const result = await registerFieldIncident({ body: validBody({ reportId: existing.reportId }) });

    expect(result.status).toBe(200);
    expect(result.payload.alreadySynced).toBe(true);
    expect(result.payload.displayId).toBe(existing.displayId);
    expect(FieldIncident.create).not.toHaveBeenCalled();
  });

  test('trims the reportId before the idempotency lookup', async () => {
    const existing = storedDoc();
    FieldIncident.findOne.mockResolvedValue(existing);

    await registerFieldIncident({ body: validBody({ reportId: `  ${existing.reportId}  ` }) });

    expect(FieldIncident.findOne).toHaveBeenCalledWith({ reportId: existing.reportId });
  });

  test('creates a report and returns 201 with displayId/receivedAt', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    const created = storedDoc();
    FieldIncident.create.mockResolvedValue(created);

    const body = validBody();
    const result = await registerFieldIncident({ body, reporter: 'user-1' });

    expect(result.status).toBe(201);
    expect(result.payload.reportId).toBe(created.reportId);
    expect(result.payload.displayId).toBe('FI-2026-0001');
    expect(FieldIncident.create).toHaveBeenCalledWith(
      expect.objectContaining({ displayId: 'FI-2026-0001', reporter: 'user-1' })
    );
  });

  test('missing fields return 400 with { message, errors }', async () => {
    FieldIncident.findOne.mockResolvedValue(null);

    const result = await registerFieldIncident({ body: { reportId: uuid() } });

    expect(result.status).toBe(400);
    expect(result.payload.message).toBe('Validation failed');
    expect(result.payload.errors.find((e) => e.field === 'incidentType').message).toBe(
      'Unknown incident type'
    );
    expect(FieldIncident.create).not.toHaveBeenCalled();
  });

  test('unsupported photo MIME maps to 415', async () => {
    FieldIncident.findOne.mockResolvedValue(null);

    const result = await registerFieldIncident({
      body: validBody({ photo: { path: '/uploads/x.pdf', mimeType: 'application/pdf', size: 1024 } })
    });

    expect(result.status).toBe(415);
  });

  test('oversize photo maps to 413', async () => {
    FieldIncident.findOne.mockResolvedValue(null);

    const result = await registerFieldIncident({
      body: validBody({
        photo: { path: '/uploads/big.jpg', mimeType: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }
      })
    });

    expect(result.status).toBe(413);
  });

  test('concurrent duplicate insert (11000) returns the stored report', async () => {
    FieldIncident.findOne.mockResolvedValueOnce(null);
    const stored = storedDoc();
    const dupError = new Error('duplicate key');
    dupError.code = 11000;
    FieldIncident.create.mockRejectedValue(dupError);
    FieldIncident.findOne.mockResolvedValueOnce(stored);

    const result = await registerFieldIncident({ body: validBody({ reportId: stored.reportId }) });

    expect(result.status).toBe(200);
    expect(result.payload.alreadySynced).toBe(true);
  });

  test('non-duplicate database errors are rethrown', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockRejectedValue(new Error('db down'));

    await expect(registerFieldIncident({ body: validBody() })).rejects.toThrow('db down');
  });
});

describe('toPublicReport', () => {
  test('returns null photo when none was stored and unwraps mongoose docs', () => {
    const doc = { ...storedDoc({ photo: null }), toObject() { return { ...this }; } };
    const pub = toPublicReport(doc);
    expect(pub.photo).toBeNull();
    expect(pub.reportId).toBe(doc.reportId);
    expect(pub).not.toHaveProperty('__v');
  });

  test('passes through a stored photo with a path', () => {
    const photo = { path: '/uploads/a.jpg', mimeType: 'image/jpeg', size: 10 };
    expect(toPublicReport(storedDoc({ photo })).photo).toEqual(photo);
  });
});

describe('syncFieldIncidents (mocked model)', () => {
  function req(body, user = { id: 'user-1' }) {
    return { body, user };
  }

  test('rejects a non-array payload with 400', async () => {
    const res = mockRes();
    await syncFieldIncidents(req({}), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects batches over the 100-report limit', async () => {
    const res = mockRes();
    await syncFieldIncidents(req({ reports: new Array(101).fill(validBody()) }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('100') })
    );
  });

  test('flags items without a reportId without aborting the batch', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockImplementation((doc) => Promise.resolve(storedDoc({ ...doc })));
    const res = mockRes();
    const good = validBody();

    await syncFieldIncidents(req({ reports: [{ incidentType: 'footprints' }, good] }), res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.results).toHaveLength(2);
    expect(payload.results[0].ok).toBe(false);
    expect(payload.results[0].errors[0].field).toBe('reportId');
    expect(payload.results[1].ok).toBe(true);
    expect(payload.synced).toBe(1);
  });

  test('keeps successes and reports per-item failures', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockImplementation((doc) => Promise.resolve(storedDoc({ ...doc })));
    const res = mockRes();

    await syncFieldIncidents(
      req({ reports: [validBody({ incidentType: 'footprints' }), { reportId: uuid() }] }),
      res,
      jest.fn()
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.synced).toBe(1);
    expect(payload.results[0].displayId).toMatch(/^FI-/);
    expect(payload.results[1].ok).toBe(false);
  });

  test('marks already-synced retries without duplicating', async () => {
    const existing = storedDoc();
    FieldIncident.findOne.mockResolvedValue(existing);
    const res = mockRes();

    await syncFieldIncidents(req({ reports: [validBody({ reportId: existing.reportId })] }), res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.synced).toBe(1);
    expect(payload.results[0].alreadySynced).toBe(true);
  });

  test('records a per-item failure when storage throws mid-batch', async () => {
    FieldIncident.findOne.mockRejectedValueOnce(new Error('db down'));
    const res = mockRes();
    const item = validBody();

    await syncFieldIncidents(req({ reports: [item] }), res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.synced).toBe(0);
    expect(payload.results[0]).toMatchObject({ reportId: item.reportId, ok: false });
    expect(payload.results[0].message).toBe('db down');
  });

  test('forwards unexpected batch errors to next', async () => {
    const next = jest.fn();
    const res = { status: jest.fn(), json: jest.fn(() => { throw new Error('serialize fail'); }) };

    await syncFieldIncidents(req({ reports: [] }), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('myFieldIncidents / getFieldIncident (mocked model)', () => {  test('mine returns the caller reports newest-first with count', async () => {
    const reports = [storedDoc(), storedDoc()];
    FieldIncident.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(reports) })
    });
    const res = mockRes();

    await myFieldIncidents({ query: {}, user: { id: 'user-1' } }, res, jest.fn());

    expect(FieldIncident.find).toHaveBeenCalledWith({ reporter: 'user-1' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2, reports: expect.any(Array) })
    );
  });

  test('mine clamps the limit to 200', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    FieldIncident.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit }) });
    const res = mockRes();

    await myFieldIncidents({ query: { limit: '9999' }, user: { id: 'user-1' } }, res, jest.fn());

    expect(limit).toHaveBeenCalledWith(200);
  });

  test('mine forwards database errors to next', async () => {
    FieldIncident.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const next = jest.fn();
    await myFieldIncidents({ query: {}, user: { id: 'user-1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('get by reportId returns 404 when unknown', async () => {
    FieldIncident.findOne.mockResolvedValue(null);
    const res = mockRes();

    await getFieldIncident({ params: { reportId: 'missing' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('get by reportId returns the public report', async () => {
    const doc = storedDoc();
    FieldIncident.findOne.mockResolvedValue(doc);
    const res = mockRes();

    await getFieldIncident({ params: { reportId: doc.reportId } }, res, jest.fn());

    expect(FieldIncident.findOne).toHaveBeenCalledWith({ reportId: doc.reportId });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ reportId: doc.reportId }));
  });

  test('get forwards database errors to next', async () => {
    FieldIncident.findOne.mockRejectedValue(new Error('db down'));
    const next = jest.fn();
    await getFieldIncident({ params: { reportId: 'x' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('createFieldIncident (mocked upload + model)', () => {
  function req(body = {}, file = null, user = { id: 'user-1' }) {
    return { body, file, user };
  }

  beforeEach(() => {
    upload.single.mockReset();
  });

  test('creates a report and answers 201', async () => {
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(null));
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockImplementation((doc) => Promise.resolve(storedDoc({ ...doc })));
    const res = mockRes();
    const body = validBody();

    createFieldIncident(req(body), res, jest.fn());
    await new Promise((r) => setImmediate(r));

    expect(upload.single).toHaveBeenCalledWith('photo');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ reportId: body.reportId }));
  });

  test('returns the stored report (200) for an already-synced reportId', async () => {
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(null));
    FieldIncident.findOne.mockResolvedValue(storedDoc());
    const res = mockRes();

    createFieldIncident(req(validBody()), res, jest.fn());
    await new Promise((r) => setImmediate(r));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadySynced: true }));
  });

  test('oversize multipart photo answers 413', async () => {
    const err = new Error('too large');
    err.code = 'LIMIT_FILE_SIZE';
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(err));
    const res = mockRes();

    createFieldIncident(req({}), res, jest.fn());
    await new Promise((r) => setImmediate(r));

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('5 MB') })
    );
    expect(FieldIncident.create).not.toHaveBeenCalled();
  });

  test('unsupported multipart type answers 415', async () => {
    const err = new Error('bad type');
    err.code = 'UNSUPPORTED_TYPE';
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(err));
    const res = mockRes();

    createFieldIncident(req({}), res, jest.fn());
    await new Promise((r) => setImmediate(r));

    expect(res.status).toHaveBeenCalledWith(415);
  });

  test('unexpected upload errors go to next', async () => {
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(new Error('disk gone')));
    const next = jest.fn();

    createFieldIncident(req({}), mockRes(), next);
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('validation failure removes the uploaded file and answers 400', async () => {
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(null));
    FieldIncident.findOne.mockResolvedValue(null);
    const unlink = jest.spyOn(fs, 'unlink').mockImplementation((_p, cb) => cb && cb(null));
    const res = mockRes();

    createFieldIncident(
      req(
        { reportId: uuid() },
        { path: 'uploads/stale.jpg', filename: 'stale.jpg', mimetype: 'image/jpeg', size: 512 }
      ),
      res,
      jest.fn()
    );
    await new Promise((r) => setImmediate(r));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(unlink).toHaveBeenCalled();
    unlink.mockRestore();
  });

  test('database failure removes the uploaded file and calls next', async () => {
    upload.single.mockImplementation(() => (_req, _res, cb) => cb(null));
    FieldIncident.findOne.mockResolvedValue(null);
    FieldIncident.create.mockRejectedValue(new Error('db down'));
    const unlink = jest.spyOn(fs, 'unlink').mockImplementation((_p, cb) => cb && cb(null));
    const next = jest.fn();

    createFieldIncident(
      req(
        validBody(),
        { path: 'uploads/stale.jpg', filename: 'stale.jpg', mimetype: 'image/jpeg', size: 512 }
      ),
      mockRes(),
      next
    );
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(unlink).toHaveBeenCalled();
    unlink.mockRestore();
  });
});

describe('fieldIncidents routes wiring', () => {
  test('exposes POST /, POST /sync, GET /mine and GET /:reportId behind auth', () => {
    const router = require('../routes/fieldIncidents');
    const routes = router.stack
      .filter((l) => l.route)
      .map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
    expect(routes).toEqual(['POST /', 'POST /sync', 'GET /mine', 'GET /:reportId']);
    for (const layer of router.stack.filter((l) => l.route)) {
      // auth middleware runs before the handler on every route
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
    }
  });
});
