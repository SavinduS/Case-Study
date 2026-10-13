import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import { isNetworkError, submitFieldIncident, syncPendingIncidents } from '../services/syncService';
import type { StoredFieldIncident } from '../services/incidentStorage';

function incident(): ValidatedFieldIncident {
  return {
    capturedAt: new Date().toISOString(),
    incidentType: 'animal_carcass',
    description: 'herd near fence',
    location: { coordinates: [81.41, 6.47], manual: false },
    photoUri: null
  };
}

function stored(id: string, overrides: Partial<StoredFieldIncident> = {}): StoredFieldIncident {
  return {
    id,
    reportId: id,
    incident: incident(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retryCount: 0,
    ...overrides
  };
}

describe('syncService.submitFieldIncident', () => {
  it('saves offline directly when offline', async () => {
    const saved = stored('local-1');
    const out = await submitFieldIncident(incident(), {
      isOnline: () => false,
      postIncident: async () => {
        throw new Error('should not be called');
      },
      saveOffline: async () => saved
    });
    expect(out.mode).toBe('offline');
    expect(out.stored).toEqual(saved);
  });

  it('treats isOnline throwing as offline', async () => {
    const saved = stored('local-2');
    const out = await submitFieldIncident(incident(), {
      isOnline: () => {
        throw new Error('net check failed');
      },
      postIncident: async () => ({ serverId: 'S-1' }),
      saveOffline: async () => saved
    });
    expect(out.mode).toBe('offline');
  });

  it('submits online directly and marks synced', async () => {
    const saved = stored('local-3');
    const postIncident = jest.fn(async () => ({ serverId: 'SRV-1' }));
    const out = await submitFieldIncident(incident(), {
      isOnline: async () => true,
      postIncident,
      saveOffline: async () => saved
    });
    expect(postIncident).toHaveBeenCalledTimes(1);
    expect(out.mode).toBe('online');
    if (out.mode === 'online') {
      expect(out.serverId).toBe('SRV-1');
      expect(out.stored.status).toBe('synced');
    }
  });

  it('falls back to offline save when online POST hits a network error', async () => {
    const saved = stored('local-4');
    const netErr = Object.assign(new Error('Cannot reach the server'), { name: 'NetworkError' });
    const out = await submitFieldIncident(incident(), {
      isOnline: async () => true,
      postIncident: async () => {
        throw netErr;
      },
      saveOffline: async () => saved
    });
    expect(out.mode).toBe('offline');
    expect(out.stored).toEqual(saved);
  });

  it('rethrows non-network server errors (validation)', async () => {
    await expect(
      submitFieldIncident(incident(), {
        isOnline: async () => true,
        postIncident: async () => {
          const e: any = new Error('Invalid incident type');
          e.name = 'ApiError';
          throw e;
        },
        saveOffline: async () => stored('x')
      })
    ).rejects.toThrow('Invalid incident type');
  });
});

describe('syncService.syncPendingIncidents', () => {
  it('syncs all pending reports to server', async () => {
    const items = [stored('a'), stored('b')];
    const synced: string[] = [];
    const summary = await syncPendingIncidents({
      listPending: async () => items,
      postIncident: async () => ({ serverId: 'S' }),
      onSynced: async (id) => {
        synced.push(id);
      },
      onFailed: async () => {},
      retryDelayMs: 0
    });
    expect(summary.synced).toEqual(['a', 'b']);
    expect(summary.failed).toEqual([]);
    expect(synced).toEqual(['a', 'b']);
  });

  it('returns empty summary when nothing is pending', async () => {
    const post = jest.fn();
    const summary = await syncPendingIncidents({
      listPending: async () => [],
      postIncident: post,
      retryDelayMs: 0
    });
    expect(post).not.toHaveBeenCalled();
    expect(summary).toEqual({ synced: [], failed: [], remaining: [] });
  });

  it('retries network failures then succeeds', async () => {
    const items = [stored('r1')];
    let calls = 0;
    const summary = await syncPendingIncidents({
      listPending: async () => items,
      postIncident: async () => {
        calls += 1;
        if (calls < 3) throw new Error('fetch failed: network down');
        return { serverId: 'S' };
      },
      onSynced: async () => {},
      onFailed: async () => {},
      maxRetries: 3,
      retryDelayMs: 0
    });
    expect(calls).toBe(3);
    expect(summary.synced).toEqual(['r1']);
  });

  it('gives up after maxRetries and leaves item remaining', async () => {
    const items = [stored('r2')];
    const failed: string[] = [];
    const summary = await syncPendingIncidents({
      listPending: async () => items,
      postIncident: async () => {
        throw new Error('Cannot reach the server');
      },
      onSynced: async () => {},
      onFailed: async (id) => {
        failed.push(id);
      },
      maxRetries: 2,
      retryDelayMs: 0
    });
    expect(summary.synced).toEqual([]);
    expect(summary.remaining).toEqual(['r2']);
    expect(failed).toEqual(['r2']);
  });

  it('records server rejections as failed without retry', async () => {
    const items = [stored('v1')];
    const post = jest.fn(async () => {
      const e: any = new Error('Invalid location');
      e.name = 'ApiError';
      throw e;
    });
    const summary = await syncPendingIncidents({
      listPending: async () => items,
      postIncident: post,
      onSynced: async () => {},
      onFailed: async () => {},
      maxRetries: 3,
      retryDelayMs: 0
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].id).toBe('v1');
  });

  it('uses injected delay between retries', async () => {
    const items = [stored('d1')];
    const delays: number[] = [];
    await syncPendingIncidents({
      listPending: async () => items,
      postIncident: async () => {
        throw new Error('offline: no connection');
      },
      onSynced: async () => {},
      onFailed: async () => {},
      maxRetries: 3,
      retryDelayMs: 10,
      delay: async (ms) => {
        delays.push(ms);
      }
    });
    expect(delays).toEqual([10, 20]);
  });

  it('handles non-Error rejections and default retry delay', async () => {
    const items = [stored('s1')];
    const summary = await syncPendingIncidents({
      listPending: async () => items,
      postIncident: async () => {
        // eslint-disable-next-line no-throw-literal
        throw 'plain string failure';
      },
      onSynced: async () => {},
      onFailed: async () => {},
      maxRetries: 1,
      retryDelayMs: 0
    });
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].error).toMatch(/plain string failure/);
  });

  it('uses default delay implementation when none injected', async () => {
    const items = [stored('dd1')];
    let calls = 0;
    const summary = await syncPendingIncidents({
      listPending: async () => items,
      postIncident: async () => {
        calls += 1;
        if (calls === 1) throw new Error('fetch failed transient');
        return { serverId: 'S-dd' };
      },
      onSynced: async () => {},
      onFailed: async () => {},
      maxRetries: 2,
      retryDelayMs: 5
    });
    expect(calls).toBe(2);
    expect(summary.synced).toEqual(['dd1']);
  });
});

describe('isNetworkError', () => {
  it('classifies network problems', () => {
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'NetworkError' }))).toBe(true);
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(true);
    expect(isNetworkError(new Error('Cannot reach the server'))).toBe(true);
    expect(isNetworkError(new Error('offline'))).toBe(true);
    expect(isNetworkError(new Error('Request aborted'))).toBe(true);
  });

  it('rejects validation errors and empty values', () => {
    expect(isNetworkError(Object.assign(new Error('bad'), { name: 'ApiError' }))).toBe(false);
    expect(isNetworkError(new Error('Invalid incident type'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

