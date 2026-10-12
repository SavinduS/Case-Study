/**
 * field-incident offline queue — the only place with localStorage logic.
 *
 * Follows `services/api.js` conventions: the API lives under `/api`, a
 * network failure surfaces as `ApiError` with `status === 0`, and breach
 * detection / persistence stay on the server. This module only holds
 * unsent payloads and replays them in order.
 *
 * Queue entry: { clientId, timestamp, status, payload, error }
 * - `clientId`  UUID made on the device, sent as `payload.clientId` so a
 *   retry can never create a duplicate (see note in `submitIncident`).
 * - `timestamp` ISO string, used for FIFO ordering.
 * - `status`    "pending" | "failed".
 */

import { createIncident } from '../services/api.js';

export const QUEUE_KEY = 'field-incident-queue-v1';

/** UUID for idempotent retries. Uses Web Crypto when available, no deps. */
export function newClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function storage() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function notifyChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('field-incident-queue-change'));
  }
}

/** All queued entries, oldest first. Never throws — corrupt data resets. */
export function loadQueue() {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.clientId === 'string' && e.payload)
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  storage()?.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyChanged();
}

/** Number of entries still waiting (pending + failed). */
export function getPendingCount() {
  return loadQueue().length;
}

/**
 * Save a payload locally instead of showing an error.
 * Reuses `payload.clientId` when present so an edit of a queued incident
 * updates the same entry rather than adding a duplicate.
 */
export function enqueueIncident(payload = {}) {
  const queue = loadQueue();
  const clientId = payload.clientId ?? newClientId();
  const entry = {
    clientId,
    timestamp: new Date().toISOString(),
    status: 'pending',
    payload: { ...payload, clientId }
  };
  const existing = queue.findIndex((e) => e.clientId === clientId);
  if (existing >= 0) queue[existing] = entry;
  else queue.push(entry);
  saveQueue(queue);
  return entry;
}

/** Drop one entry after the server confirms it. */
export function removeFromQueue(clientId) {
  saveQueue(loadQueue().filter((e) => e.clientId !== clientId));
}

/** Keep the entry but flag it so the list can show "Failed" + Retry. */
export function markFailed(clientId, message) {
  saveQueue(
    loadQueue().map((e) =>
      e.clientId === clientId
        ? { ...e, status: 'failed', error: message ?? 'Sync failed' }
        : e
    )
  );
}

/** A status-0 ApiError (see services/api.js) means the network is down. */
export function isNetworkError(err) {
  return err?.status === 0 || err?.name === 'TypeError';
}

/**
 * Try the API first; on any failure queue locally and report it instead of
 * throwing. Returns `{ queued: false, data }` on success or
 * `{ queued: true, entry }` when stored offline.
 */
export async function submitIncident(payload = {}, sender = createIncident) {
  const body = { ...payload, clientId: payload.clientId ?? newClientId() };
  try {
    const data = await sender(body);
    return { queued: false, data };
  } catch {
    // Offline or server error — keep the report on the device.
    const entry = enqueueIncident(body);
    return { queued: true, entry };
  }
}

/**
 * Send queued items one by one, oldest first. Each success is removed;
 * each failure stays with `status: "failed"` so the UI can offer Retry.
 * Continues past failures so one bad payload never blocks the rest.
 */
export async function syncQueue(sender = createIncident) {
  const queue = loadQueue();
  const synced = [];
  let remaining = [...queue];
  for (const item of queue) {
    try {
      await sender(item.payload);
      synced.push(item);
      remaining = remaining.filter((e) => e.clientId !== item.clientId);
      saveQueue(remaining);
    } catch (err) {
      const message = err?.message ?? 'Sync failed';
      remaining = remaining.map((e) =>
        e.clientId === item.clientId ? { ...e, status: 'failed', error: message } : e
      );
      saveQueue(remaining);
    }
  }
  return { synced, remaining };
}
