import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkError, syncReports, uploadPhoto } from '../api/client';
import type {
  ConflictReportConfirmation,
  QueuedReport,
  ReportSubmission,
  SyncResult
} from '../types';

const STORAGE_KEY = '@wildlife-alert/conflict-report-queue';
const MAX_HISTORY = 50;

export function newClientRefId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadQueue(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedReport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

// Serialize every read-modify-write cycle on the queue. Network calls stay
// outside the lock; only the load→merge→save sections are serialized, so a
// concurrent enqueue/recordOnlineSuccess can never overwrite a flush that
// completed in between (which would revert a synced row back to PENDING).
let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queueLock.then(task, task);
  queueLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// Keep every pending item plus the newest RECEIVED ones (local history)
function prune(queue: QueuedReport[]): QueuedReport[] {
  const pending = queue.filter((q) => q.status === 'PENDING_UPLOAD');
  const received = queue
    .filter((q) => q.status === 'RECEIVED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_HISTORY);
  return [...pending, ...received];
}

// All reports this device knows about, newest first: still on the device
// (PENDING_UPLOAD) and already uploaded (RECEIVED) — used by My Reports.
export async function listReports(): Promise<QueuedReport[]> {
  const queue = await loadQueue();
  return [...queue].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// The server accepted an online submission — keep it in the local history so
// the villager can still see the CR- id after leaving the success screen.
export function recordOnlineSuccess(
  confirmation: ConflictReportConfirmation,
  payload: ReportSubmission
): Promise<void> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    if (queue.some((q) => q.reportId === confirmation.reportId)) return;
    queue.push({
      clientRefId: newClientRefId(),
      payload,
      status: 'RECEIVED',
      reportId: confirmation.reportId,
      createdAt: confirmation.createdAt
    });
    await saveQueue(prune(queue));
  });
}

// FR-13: store a report locally with a client-generated reference
export function enqueue(
  payload: ReportSubmission,
  photoUri?: string
): Promise<QueuedReport> {
  return withQueueLock(async () => {
    const clientRefId = payload.clientRefId ?? newClientRefId();
    const entry: QueuedReport = {
      clientRefId,
      payload: { ...payload, clientRefId },
      photoUri,
      status: 'PENDING_UPLOAD',
      createdAt: new Date().toISOString()
    };
    const queue = await loadQueue();
    queue.push(entry);
    await saveQueue(queue);
    return entry;
  });
}

export interface FlushResult {
  synced: QueuedReport[];
  remaining: QueuedReport[];
}

// Turn a server sync rejection into text a villager can act on
function describeRejection(result?: SyncResult): string {
  if (result?.errors && Object.keys(result.errors).length > 0) {
    return Object.entries(result.errors)
      .map(([field, msg]) => (field === 'message' ? msg : `${field}: ${msg}`))
      .join('; ');
  }
  return result?.message || 'Server rejected the report';
}

function applyUpdate(base: QueuedReport, updated: QueuedReport): QueuedReport {
  return {
    ...base,
    status: updated.status,
    reportId: updated.reportId,
    lastError: updated.lastError,
    photoUri: updated.photoUri,
    payload: updated.payload
  };
}

// FR-14: upload any local photo, then bulk-sync the queue. Idempotent on the
// server via clientRefId, so a partial retry can never create duplicates.
export async function flushQueue(): Promise<FlushResult> {
  const queue = await withQueueLock(loadQueue);
  const pending = queue.filter((q) => q.status === 'PENDING_UPLOAD');
  if (pending.length === 0) return { synced: [], remaining: [] };

  const remaining: QueuedReport[] = [];
  const ready: QueuedReport[] = [];
  const changed = new Set<string>();
  const synced: QueuedReport[] = [];

  // Network phase — deliberately outside the queue lock
  for (let i = 0; i < pending.length; i += 1) {
    const item = pending[i];
    if (item.photoUri && !item.payload.photoUrl) {
      try {
        item.payload.photoUrl = await uploadPhoto(item.photoUri);
        item.photoUri = undefined;
        changed.add(item.clientRefId);
      } catch (e) {
        if (e instanceof NetworkError) {
          remaining.push(...pending.slice(i));
          break;
        }
        // E5: photo keeps failing permanently → send the report without it
        item.photoUri = undefined;
        changed.add(item.clientRefId);
      }
    }
    ready.push(item);
  }

  if (ready.length > 0) {
    try {
      const res = await syncReports(ready.map((item) => item.payload));
      const byRef = new Map(res.results.map((r) => [r.clientRefId, r]));
      for (const item of ready) {
        const r = byRef.get(item.clientRefId);
        if (r && r.ok && r.reportId) {
          item.status = 'RECEIVED';
          item.reportId = r.reportId;
          item.lastError = undefined;
          synced.push(item);
          changed.add(item.clientRefId);
        } else {
          item.lastError = describeRejection(r);
          remaining.push(item);
          changed.add(item.clientRefId);
        }
      }
    } catch {
      remaining.push(...ready);
    }
  }

  // Merge phase — serialized against enqueue/recordOnlineSuccess
  if (changed.size > 0) {
    await withQueueLock(async () => {
      const fresh = await loadQueue();
      const updates = new Map(
        pending.filter((i) => changed.has(i.clientRefId)).map((i) => [i.clientRefId, i])
      );
      const merged = fresh.map((q) => {
        const update = updates.get(q.clientRefId);
        return update ? applyUpdate(q, update) : q;
      });
      await saveQueue(merged);
    });
  }

  return { synced, remaining };
}
