import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkError, syncReports, uploadPhoto } from '../api/client';
import type { QueuedReport, ReportSubmission } from '../types';

const STORAGE_KEY = '@wildlife-alert/conflict-report-queue';

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

// FR-13: store a report locally with a client-generated reference
export async function enqueue(
  payload: ReportSubmission,
  photoUri?: string
): Promise<QueuedReport> {
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
}

export interface FlushResult {
  synced: QueuedReport[];
  remaining: QueuedReport[];
}

// FR-14: upload any local photo, then bulk-sync the queue. Idempotent on the
// server via clientRefId, so a partial retry can never create duplicates.
export async function flushQueue(): Promise<FlushResult> {
  const queue = await loadQueue();
  const pending = queue.filter((q) => q.status === 'PENDING_UPLOAD');
  if (pending.length === 0) return { synced: [], remaining: [] };

  const remaining: QueuedReport[] = [];
  const ready: QueuedReport[] = [];

  for (let i = 0; i < pending.length; i += 1) {
    const item = pending[i];
    if (item.photoUri && !item.payload.photoUrl) {
      try {
        item.payload.photoUrl = await uploadPhoto(item.photoUri);
        item.photoUri = undefined;
      } catch (e) {
        if (e instanceof NetworkError) {
          remaining.push(...pending.slice(i));
          break;
        }
        // E5: photo keeps failing permanently → send the report without it
        item.photoUri = undefined;
      }
    }
    ready.push(item);
  }

  const synced: QueuedReport[] = [];
  if (ready.length > 0) {
    try {
      const res = await syncReports(ready.map((item) => item.payload));
      const byRef = new Map(res.results.map((r) => [r.clientRefId, r]));
      for (const item of ready) {
        const r = byRef.get(item.clientRefId);
        if (r && r.ok && r.reportId) {
          item.status = 'RECEIVED';
          item.reportId = r.reportId;
          synced.push(item);
        } else {
          item.lastError = r?.errors ? JSON.stringify(r.errors) : 'Server rejected the report';
          remaining.push(item);
        }
      }
    } catch {
      remaining.push(...ready);
    }
  }

  const others = queue.filter((q) => q.status !== 'PENDING_UPLOAD');
  await saveQueue([...others, ...remaining]);
  return { synced, remaining };
}
