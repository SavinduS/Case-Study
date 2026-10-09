type FetchMock = jest.Mock & { mockResolvedValueOnce?: unknown };

function okResponse(status = 200) {
  return { ok: status < 300, status };
}

describe('baseUrl', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn(async () => okResponse());
    (globalThis as { fetch: unknown }).fetch = fetchMock;
  });

  function load() {
    return require('../baseUrl') as typeof import('../baseUrl');
  }

  it('probes candidates in order and caches the first that answers', async () => {
    const { probeServer, getActiveBaseUrl } = load();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes(':5001') ? okResponse() : Promise.reject(new Error('down'))
    );
    const result = await probeServer(50);
    expect(result).toEqual({ base: 'http://192.168.50.10:5001', reachable: true });
    expect(getActiveBaseUrl()).toBe('http://192.168.50.10:5001');
  });

  it('treats a 304 as reachable (revalidated cache)', async () => {
    const { probeServer } = load();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 304 });
    const result = await probeServer(50);
    expect(result.reachable).toBe(true);
  });

  it('tries the cached base first on the next probe', async () => {
    const { probeServer } = load();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes(':5001') ? okResponse() : Promise.reject(new Error('down'))
    );
    await probeServer(50);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(okResponse());
    await probeServer(50);
    expect(String(fetchMock.mock.calls[0][0])).toContain(':5001');
  });

  it('returns reachable:false with the first candidate when nothing answers', async () => {
    const { probeServer } = load();
    fetchMock.mockRejectedValue(new Error('down'));
    const result = await probeServer(20);
    expect(result).toEqual({ base: 'http://192.168.50.10:5000', reachable: false });
  });

  it('aborts a probe that exceeds the timeout', async () => {
    const { probeServer } = load();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    );
    const result = await probeServer(30);
    expect(result.reachable).toBe(false);
  });

  it('getBaseUrl re-resolves when nothing is cached, and returns the cache when set', async () => {
    const { probeServer, getBaseUrl } = load();
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await getBaseUrl()).toBe('http://192.168.50.10:5000');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse());
    await probeServer(50);
    expect(await getBaseUrl()).toBe('http://192.168.50.10:5000');
  });

  it('invalidateBaseUrl clears the matching cached base (or any when omitted)', async () => {
    const { probeServer, getActiveBaseUrl, invalidateBaseUrl } = load();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes(':5001') ? okResponse() : Promise.reject(new Error('down'))
    );
    await probeServer(50);
    invalidateBaseUrl('http://elsewhere:5000');
    expect(getActiveBaseUrl()).toBe('http://192.168.50.10:5001');
    invalidateBaseUrl('http://192.168.50.10:5001');
    expect(getActiveBaseUrl()).toBe('http://192.168.50.10:5000');
    await probeServer(50);
    invalidateBaseUrl();
    expect(getActiveBaseUrl()).toBe('http://192.168.50.10:5000');
  });
});
