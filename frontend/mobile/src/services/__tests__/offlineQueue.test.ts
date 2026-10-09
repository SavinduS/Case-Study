import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkError, syncReports, uploadPhoto } from '../../api/client';
import {
  enqueue,
  flushQueue,
  listReports,
  loadQueue,
  newClientRefId,
  recordOnlineSuccess
} from '../offlineQueue';
import type { ConflictReportConfirmation, ReportSubmission } from '../../types';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    syncReports: jest.fn(),
    uploadPhoto: jest.fn()
  };
});

const syncMock = syncReports as jest.MockedFunction<typeof syncReports>;
const uploadMock = uploadPhoto as jest.MockedFunction<typeof uploadPhoto>;

const STORAGE_KEY = '@wildlife-alert/conflict-report-queue';

function submission(extra: Partial<ReportSubmission> = {}): ReportSubmission {
  return {
    incidentType: 'crop_damage',
    location: { coordinates: [81.4, 6.35] },
    ...extra
  };
}

function confirmation(reportId: string): ConflictReportConfirmation {
  return {
    reportId,
    status: 'RECEIVED',
    submissionMethod: 'app',
    incidentType: 'crop_damage',
    createdAt: '2026-01-01T10:00:00.000Z'
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('newClientRefId', () => {
  it('generates unique local- prefixed ids', () => {
    const a = newClientRefId();
    const b = newClientRefId();
    expect(a).toMatch(/^local-\d+-[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});

describe('loadQueue', () => {
  it('returns [] when nothing is stored', async () => {
    await expect(loadQueue()).resolves.toEqual([]);
  });

  it('returns [] when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');
    await expect(loadQueue()).resolves.toEqual([]);
  });
});

describe('enqueue', () => {
  it('stores a PENDING_UPLOAD entry with a generated clientRefId', async () => {
    const entry = await enqueue(submission());
    expect(entry.status).toBe('PENDING_UPLOAD');
    expect(entry.clientRefId).toMatch(/^local-/);
    expect(entry.payload.clientRefId).toBe(entry.clientRefId);
    const stored = await loadQueue();
    expect(stored).toHaveLength(1);
    expect(stored[0].clientRefId).toBe(entry.clientRefId);
  });

  it('keeps a caller-provided clientRefId and photoUri', async () => {
    const entry = await enqueue(submission({ clientRefId: 'mine-1' }), 'file:///p.jpg');
    expect(entry.clientRefId).toBe('mine-1');
    expect(entry.photoUri).toBe('file:///p.jpg');
  });

  it('serializes concurrent enqueues without losing entries', async () => {
    await Promise.all([
      enqueue(submission({ clientRefId: 'a' })),
      enqueue(submission({ clientRefId: 'b' })),
      enqueue(submission({ clientRefId: 'c' }))
    ]);
    const queue = await loadQueue();
    expect(queue.map((q) => q.clientRefId).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('listReports', () => {
  it('returns every entry newest first', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { clientRefId: 'old', status: 'RECEIVED', createdAt: '2026-01-01T00:00:00.000Z', payload: submission(), reportId: 'CR-1' },
        { clientRefId: 'new', status: 'PENDING_UPLOAD', createdAt: '2026-01-02T00:00:00.000Z', payload: submission() }
      ])
    );
    const list = await listReports();
    expect(list.map((q) => q.clientRefId)).toEqual(['new', 'old']);
  });
});

describe('recordOnlineSuccess', () => {
  it('adds a RECEIVED history entry for an online submission', async () => {
    await recordOnlineSuccess(confirmation('CR-42'), submission());
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ status: 'RECEIVED', reportId: 'CR-42' });
  });

  it('ignores a duplicate reportId (idempotent)', async () => {
    await recordOnlineSuccess(confirmation('CR-42'), submission());
    await recordOnlineSuccess(confirmation('CR-42'), submission());
    expect(await loadQueue()).toHaveLength(1);
  });

  it('prunes the oldest RECEIVED entries beyond 50 but keeps all pending', async () => {
    for (let i = 0; i < 55; i += 1) {
      await recordOnlineSuccess(
        confirmation(`CR-${i}`),
        submission()
      );
    }
    await enqueue(submission({ clientRefId: 'pending-1' }));
    const queue = await loadQueue();
    const pending = queue.filter((q) => q.status === 'PENDING_UPLOAD');
    const received = queue.filter((q) => q.status === 'RECEIVED');
    expect(pending).toHaveLength(1);
    expect(received).toHaveLength(50);
  });
});

describe('flushQueue', () => {
  it('returns empty when there is nothing pending', async () => {
    await expect(flushQueue()).resolves.toEqual({ synced: [], remaining: [] });
  });

  it('syncs pending reports and marks them RECEIVED', async () => {
    const { clientRefId } = await enqueue(submission());
    syncMock.mockResolvedValueOnce({
      synced: 1,
      results: [{ clientRefId, ok: true, reportId: 'CR-7', status: 'RECEIVED' }]
    });
    const result = await flushQueue();
    expect(result.synced).toHaveLength(1);
    expect(result.remaining).toHaveLength(0);
    expect(syncMock).toHaveBeenCalledWith([expect.objectContaining({ clientRefId })]);
    const queue = await loadQueue();
    expect(queue[0]).toMatchObject({ status: 'RECEIVED', reportId: 'CR-7' });
  });

  it('uploads a local photo first and clears photoUri on success', async () => {
    const { clientRefId } = await enqueue(submission(), 'file:///photo.jpg');
    uploadMock.mockResolvedValueOnce('http://cdn/photo.jpg');
    syncMock.mockResolvedValueOnce({
      synced: 1,
      results: [{ clientRefId, ok: true, reportId: 'CR-8', status: 'RECEIVED' }]
    });
    await flushQueue();
    expect(uploadMock).toHaveBeenCalledWith('file:///photo.jpg');
    expect(syncMock).toHaveBeenCalledWith([
      expect.objectContaining({ photoUrl: 'http://cdn/photo.jpg' })
    ]);
    const queue = await loadQueue();
    expect(queue[0].photoUri).toBeUndefined();
    expect(queue[0].payload.photoUrl).toBe('http://cdn/photo.jpg');
  });

  it('stops the batch on a photo NetworkError and records a reason', async () => {
    await enqueue(submission({ clientRefId: 'p1' }), 'file:///a.jpg');
    await enqueue(submission({ clientRefId: 'p2' }), 'file:///b.jpg');
    uploadMock.mockRejectedValue(new NetworkError('http://api.test'));
    const result = await flushQueue();
    expect(result.synced).toHaveLength(0);
    expect(result.remaining.map((r) => r.clientRefId)).toEqual(['p1', 'p2']);
    expect(result.remaining[0].lastError).toMatch(/waiting for a connection/);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('drops only the photo (keeps the report) when the upload fails permanently', async () => {
    const { clientRefId } = await enqueue(submission({ clientRefId: 'p3' }), 'file:///bad.jpg');
    uploadMock.mockRejectedValue(Object.assign(new Error('415'), { status: 415 }));
    syncMock.mockResolvedValueOnce({
      synced: 1,
      results: [{ clientRefId, ok: true, reportId: 'CR-9', status: 'RECEIVED' }]
    });
    const result = await flushQueue();
    expect(result.synced).toHaveLength(1);
    expect(syncMock).toHaveBeenCalledWith([expect.not.objectContaining({ photoUrl: expect.anything() })]);
    const queue = await loadQueue();
    expect(queue[0].photoUri).toBeUndefined();
  });

  it('records field errors from a rejected sync result', async () => {
    const { clientRefId } = await enqueue(submission({ clientRefId: 'p4' }));
    syncMock.mockResolvedValueOnce({
      synced: 0,
      results: [
        {
          clientRefId,
          ok: false,
          errors: { incidentType: 'Required', message: 'Rejected' }
        }
      ]
    });
    const result = await flushQueue();
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].lastError).toBe('incidentType: Required; Rejected');
  });

  it('falls back to the plain message when a rejection has no field errors', async () => {
    const { clientRefId } = await enqueue(submission({ clientRefId: 'p5' }));
    syncMock.mockResolvedValueOnce({
      synced: 0,
      results: [{ clientRefId, ok: false, message: 'Too many reports today' }]
    });
    const result = await flushQueue();
    expect(result.remaining[0].lastError).toBe('Too many reports today');
  });

  it('uses a generic reason when the rejection has neither message nor errors', async () => {
    const { clientRefId } = await enqueue(submission({ clientRefId: 'p6' }));
    syncMock.mockResolvedValueOnce({
      synced: 0,
      results: [{ clientRefId, ok: false }]
    });
    const result = await flushQueue();
    expect(result.remaining[0].lastError).toBe('Server rejected the report');
  });

  it('keeps reports in the queue when the sync request itself fails', async () => {
    await enqueue(submission({ clientRefId: 'p7' }));
    syncMock.mockRejectedValueOnce(new NetworkError('http://api.test'));
    const result = await flushQueue();
    expect(result.synced).toHaveLength(0);
    expect(result.remaining.map((r) => r.clientRefId)).toEqual(['p7']);
    const queue = await loadQueue();
    expect(queue[0].status).toBe('PENDING_UPLOAD');
  });
});
