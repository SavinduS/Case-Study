import { ApiError, NetworkError, createReport, getReport, syncReports, uploadPhoto } from '../client';
import * as baseUrl from '../baseUrl';
import type { ReportSubmission } from '../../types';

jest.mock('../baseUrl', () => ({
  getBaseUrl: jest.fn(async () => 'http://api.test'),
  getActiveBaseUrl: jest.fn(() => 'http://api.test'),
  invalidateBaseUrl: jest.fn(),
  probeServer: jest.fn(async () => ({ base: 'http://api.test', reachable: true }))
}));

const fetchMock = jest.fn();
(globalThis as { fetch: unknown }).fetch = fetchMock;

const sampleSubmission: ReportSubmission = {
  incidentType: 'elephant_sighting',
  location: { coordinates: [81.42, 6.62] }
};

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status < 300,
    status,
    json: async () => payload
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('client request handling', () => {
  it('createReport posts JSON with the right headers and returns the confirmation', async () => {
    const confirmation = { reportId: 'CR-1', status: 'RECEIVED' };
    fetchMock.mockResolvedValueOnce(jsonResponse(confirmation));
    const result = await createReport(sampleSubmission);
    expect(result).toEqual(confirmation);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/conflict-reports');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual(sampleSubmission);
  });

  it('getReport performs a GET against the report path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ reportId: 'CR-9' }));
    await getReport('CR-9');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/conflict-reports/CR-9');
  });

  it('syncReports posts the reports batch', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ synced: 1, results: [] }));
    await syncReports([sampleSubmission]);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ reports: [sampleSubmission] });
  });

  it('throws ApiError carrying status and payload on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Validation failed' }, 422));
    expect.assertions(4);
    try {
      await createReport(sampleSubmission);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(422);
      expect((e as ApiError).message).toBe('Validation failed');
      expect((e as ApiError).payload).toEqual({ message: 'Validation failed' });
    }
  });

  it('uses a generic message when the error payload has none', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(getReport('CR-1')).rejects.toThrow('Request failed (500)');
  });

  it('returns an empty object when a 2xx body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });
    await expect(getReport('CR-1')).resolves.toEqual({});
  });

  it('throws NetworkError and invalidates the base URL when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(createReport(sampleSubmission)).rejects.toBeInstanceOf(NetworkError);
    expect(baseUrl.invalidateBaseUrl).toHaveBeenCalledWith('http://api.test');
    await expect(createReport(sampleSubmission)).rejects.toThrow(/Cannot reach the server/);
  });
});

describe('uploadPhoto', () => {
  function partsOf(body: FormData): Array<[string, unknown]> {
    const f = body as FormData & {
      _parts?: Array<[string, unknown]>;
      entries?: () => IterableIterator<[string, unknown]>;
    };
    if (Array.isArray(f._parts)) return f._parts;
    return Array.from(f.entries());
  }

  function photoPart(body: FormData): { name: string; type: string; bytes: () => Promise<Uint8Array> } {
    const entry = partsOf(body).find(([key]) => key === 'photo');
    if (!entry) throw new Error('photo part missing');
    return entry[1] as { name: string; type: string; bytes: () => Promise<Uint8Array> };
  }

  it('sends a FormData photo part with name, mime type and bytes()', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ photoUrl: 'http://cdn/x.jpg' }));
    const url = await uploadPhoto('file:///photos/x.jpg?w=1');
    expect(url).toBe('http://cdn/x.jpg');
    const [reqUrl, init] = fetchMock.mock.calls[0];
    expect(reqUrl).toBe('http://api.test/api/conflict-reports/photo');
    expect(init.body).toBeInstanceOf(FormData);
    const blob = photoPart(init.body as FormData);
    expect(blob.name).toBe('x.jpg');
    expect(blob.type).toBe('image/jpeg');
    await expect(blob.bytes()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('defaults the name to photo.jpg and picks the mime type from the extension', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ photoUrl: 'http://cdn/p.png' }));
    await uploadPhoto('file:///tmp/noext');
    const blob = photoPart(fetchMock.mock.calls[0][1].body as FormData);
    expect(blob.name).toBe('photo.jpg');
    expect(blob.type).toBe('image/jpeg');
  });

  it('maps .png and .webp to their mime types', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ photoUrl: 'a' }));
    await uploadPhoto('file:///tmp/a.png');
    expect(photoPart(fetchMock.mock.calls[0][1].body as FormData).type).toBe('image/png');

    fetchMock.mockResolvedValueOnce(jsonResponse({ photoUrl: 'b' }));
    await uploadPhoto('file:///tmp/b.webp');
    expect(photoPart(fetchMock.mock.calls[1][1].body as FormData).type).toBe('image/webp');
  });

  it('propagates ApiError for a rejected upload (e.g. 413/415)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Too large' }, 413));
    await expect(uploadPhoto('file:///tmp/big.jpg')).rejects.toBeInstanceOf(ApiError);
  });
});
