import { apiBaseCandidates } from '../config';

// First base URL that answered /health, kept for later requests.
// Cleared whenever a request to it fails, so the next call re-resolves.
let activeBase: string | null = null;

export function getActiveBaseUrl(): string {
  return activeBase ?? apiBaseCandidates()[0];
}

async function probe(base: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface BaseProbeResult {
  base: string;
  reachable: boolean;
}

// Try the cached base first, then each candidate in order (port 5000, 5001,
// Android emulator, LAN). Caches the first server that answers.
export async function probeServer(timeoutMs = 2500): Promise<BaseProbeResult> {
  const candidates = apiBaseCandidates();
  const ordered = activeBase ? [activeBase, ...candidates.filter((b) => b !== activeBase)] : candidates;
  for (const base of ordered) {
    if (await probe(base, timeoutMs)) {
      activeBase = base;
      return { base, reachable: true };
    }
  }
  activeBase = null;
  return { base: candidates[0], reachable: false };
}

// Base URL for the next request: cached if known, otherwise resolves now.
// When nothing answers (offline) it returns the first candidate — the request
// itself will fail and the caller saves the report on the device.
export async function getBaseUrl(): Promise<string> {
  if (activeBase) return activeBase;
  const { base } = await probeServer();
  return base;
}

// The server we were talking to stopped responding — forget it so the next
// request re-resolves (the backend may have moved port or IP).
export function invalidateBaseUrl(base?: string): void {
  if (!base || base === activeBase) activeBase = null;
}
