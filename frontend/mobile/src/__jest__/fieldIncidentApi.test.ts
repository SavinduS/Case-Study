import { ApiError, NetworkError } from '../api/client';
import { invalidateBaseUrl } from '../api/baseUrl';
import {
  buildFieldIncidentForm,
  fetchFieldIncident,
  fetchMyFieldIncidents,
  postFieldIncident,
  resolveBackendIncidentType,
  syncFieldIncidents,
  toBackendIncidentType,
  toSyncPayloadItem
} from '../api/fieldIncidents';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

const TOKEN = 'test-jwt-token';

function incident(overrides: Partial<ValidatedFieldIncident> = {}): ValidatedFieldIncident {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare_illegal_hunting',
    description: 'Wire snare near trail',
    location: { coordinates: [36.821456, -1.292345], accuracyMeters: 8, manual: false },
    photoUri: null,
    ...overrides
  };
}

const REPORT_ID = '123e4567-e89b-12d3-a456-426614174000';

/** Route /health probes to ok, then serve queued endpoint responses. */
function mockFetch(endpointResponses: { status: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const queue = [...endpointResponses];
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/health')) {
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    const next = queue.shift() ?? { status: 500, body: { message: 'no mock response' } };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body
    };
  });
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  return { fetchMock, calls };
}

beforeEach(() => {
  invalidateBaseUrl();
});

afterEach(() => {
  invalidateBaseUrl();
  jest.restoreAllMocks();
});

describe('toBackendIncidentType', () => {
  it('passes the four canonical backend types through', () => {
    for (const t of [
      'snare_illegal_hunting',
      'animal_carcass',
      'footprints',
      'illegal_campsite'
    ] as const) {
      expect(toBackendIncidentType(t)).toBe(t);
    }
  });

  it('maps the verified legacy snare value', () => {
    expect(toBackendIncidentType('snare')).toBe('snare_illegal_hunting');
  });

  it('returns null for values with no verified equivalent (never guesses)', () => {
    // 'poacher' | 'elephant' | 'crop' belong to the villager conflict domain;
    // the backend has no matching category, so mapping must not invent one.
    for (const t of ['poacher', 'elephant', 'crop', 'elephant_sighting', 'nope']) {
      expect(toBackendIncidentType(t)).toBeNull();
    }
  });

  it('resolveBackendIncidentType leaves unknown values for the server to reject', () => {
    expect(resolveBackendIncidentType('snare_illegal_hunting')).toBe('snare_illegal_hunting');
    expect(resolveBackendIncidentType('snare')).toBe('snare_illegal_hunting');
    expect(resolveBackendIncidentType('elephant')).toBe('elephant');
  });
});

describe('buildFieldIncidentForm (multipart payload)', () => {
  it('sends latitude/longitude in API order from GeoJSON coordinates', () => {
    const form = buildFieldIncidentForm(REPORT_ID, incident());
    expect(form.get('reportId')).toBe(REPORT_ID);
    expect(form.get('incidentType')).toBe('snare_illegal_hunting');
    expect(form.get('description')).toBe('Wire snare near trail');
    // coordinates are [lng, lat]; flat fields are lat=coords[1], lng=coords[0]
    expect(form.get('latitude')).toBe('-1.292345');
    expect(form.get('longitude')).toBe('36.821456');
    expect(form.get('locationSource')).toBe('gps');
    expect(form.get('accuracy')).toBe('8');
    expect(form.get('capturedAt')).toBe(incident().capturedAt);
    expect(form.get('photo')).toBeNull();
  });

  it('marks manual pins and omits accuracy when unknown', () => {
    const form = buildFieldIncidentForm(
      REPORT_ID,
      incident({ location: { coordinates: [81.4, 6.48], manual: true } })
    );
    expect(form.get('locationSource')).toBe('manual');
    expect(form.get('accuracy')).toBeNull();
  });

  it('attaches JPEG/PNG photos, omits the part when there is no photo', () => {
    // Node's FormData stringifies plain-object parts, so capture append args
    // (the Expo runtime sends the { name, type, bytes } part as the file).
    const appended: [string, unknown][] = [];
    const origAppend = FormData.prototype.append;
    FormData.prototype.append = function (name: string, value: unknown) {
      appended.push([name, value]);
      return origAppend.call(this, name, value as never);
    };
    try {
      buildFieldIncidentForm(REPORT_ID, incident({ photoUri: 'file:///a/snare.jpg' }));
      expect(appended.find(([name]) => name === 'photo')?.[1]).toMatchObject({
        name: 'snare.jpg',
        type: 'image/jpeg'
      });
      appended.length = 0;
      buildFieldIncidentForm(REPORT_ID, incident({ photoUri: 'file:///a/print.PNG?x=1' }));
      expect(appended.find(([name]) => name === 'photo')?.[1]).toMatchObject({
        name: 'print.PNG',
        type: 'image/png'
      });
    } finally {
      FormData.prototype.append = origAppend;
    }
  });
});

describe('toSyncPayloadItem (batch JSON payload)', () => {
  it('keeps GeoJSON [lng, lat] order for the sync endpoint', () => {
    const item = toSyncPayloadItem(REPORT_ID, incident());
    expect(item.reportId).toBe(REPORT_ID);
    expect(item.incidentType).toBe('snare_illegal_hunting');
    expect(item.location.coordinates).toEqual([36.821456, -1.292345]);
    expect(item.location.source).toBe('gps');
    expect(item.location).toMatchObject({ accuracy: 8 });
  });

  it('uses manual source without accuracy when unknown', () => {
    const item = toSyncPayloadItem(
      REPORT_ID,
      incident({ location: { coordinates: [1, 2], manual: true } })
    );
    expect(item.location.source).toBe('manual');
    expect(item.location).not.toHaveProperty('accuracy');
  });
});

describe('postFieldIncident', () => {
  it('posts multipart FormData with the bearer token (201)', async () => {
    const { calls } = mockFetch([
      { status: 201, body: { reportId: REPORT_ID, displayId: 'FI-2026-0001' } }
    ]);
    const res = await postFieldIncident(REPORT_ID, incident(), TOKEN);
    expect(res.displayId).toBe('FI-2026-0001');
    const post = calls.find((c) => c.url.endsWith('/api/field-incidents'));
    expect(post).toBeDefined();
    expect(post!.init!.method).toBe('POST');
    expect((post!.init!.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`
    );
    expect(post!.init!.body).toBeInstanceOf(FormData);
  });

  it('resolves idempotent 200 already-synced retries', async () => {
    mockFetch([
      { status: 200, body: { reportId: REPORT_ID, displayId: 'FI-2026-0001', alreadySynced: true } }
    ]);
    const res = await postFieldIncident(REPORT_ID, incident(), TOKEN);
    expect(res.alreadySynced).toBe(true);
  });

  it.each([
    [400, { message: 'Validation failed', errors: [{ field: 'description', message: 'x' }] }],
    [401, { message: 'No token' }],
    [413, { message: 'Photo exceeds the 5 MB limit' }],
    [415, { message: 'Only JPEG or PNG photos are supported' }],
    [500, { message: 'Server error' }]
  ])('throws ApiError for HTTP %s', async (status, body) => {
    mockFetch([{ status, body }]);
    const attempt = postFieldIncident(REPORT_ID, incident(), TOKEN);
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status });
  });

  it('throws NetworkError when unreachable', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string) => {
      if (String(url).endsWith('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      throw new TypeError('fetch failed');
    });
    await expect(postFieldIncident(REPORT_ID, incident(), TOKEN)).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});

describe('syncFieldIncidents / fetchers', () => {
  it('posts the batch as JSON with per-item reportIds', async () => {
    const { calls } = mockFetch([
      {
        status: 200,
        body: {
          synced: 1,
          results: [{ reportId: REPORT_ID, ok: true, displayId: 'FI-2026-0001' }]
        }
      }
    ]);
    const res = await syncFieldIncidents([{ reportId: REPORT_ID, incident: incident() }], TOKEN);
    expect(res.synced).toBe(1);
    const call = calls.find((c) => c.url.endsWith('/api/field-incidents/sync'));
    const sent = JSON.parse(String(call!.init!.body));
    expect(sent.reports[0].reportId).toBe(REPORT_ID);
    expect(sent.reports[0].incidentType).toBe('snare_illegal_hunting');
    expect(sent.reports[0].location.coordinates).toEqual([36.821456, -1.292345]);
  });

  it('fetches my reports and a single report with the token', async () => {
    mockFetch([
      { status: 200, body: { count: 1, reports: [{ reportId: REPORT_ID }] } },
      { status: 200, body: { reportId: REPORT_ID, displayId: 'FI-2026-0001' } }
    ]);
    const mine = await fetchMyFieldIncidents(TOKEN);
    expect(mine.count).toBe(1);
    const one = await fetchFieldIncident(REPORT_ID, TOKEN);
    expect(one.displayId).toBe('FI-2026-0001');
  });
});
