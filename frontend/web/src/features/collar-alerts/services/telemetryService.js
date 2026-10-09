/**
 * MockTelemetryGateway
 *
 * Stands in for the IoT data gateway / satellite link that forwards collar
 * fixes to WildlifeDB.insertTelemetryData(). It drives the three ingestion
 * paths named in the use case:
 *   - live periodic fixes (main flow, step 1)
 *   - a collar that goes Signal Lost (exception flow 1)
 *   - a batch upload of historical fixes after reconnect (alternate flow D)
 *
 * Positions follow scripted tracks so a demo always reproduces the same
 * breach without needing the real backend.
 */

const LIVE_TRACKS = {
  // E-402 walks west out of the park and into Z1 (western farmland).
  'E-402': [
    [81.06, 8.24],
    [81.048, 8.24],
    [81.036, 8.241],
    [81.024, 8.242],
    [81.012, 8.243]
  ],
  // E-331 stays inside the park.
  'E-331': [
    [81.09, 8.2],
    [81.094, 8.196]
  ]
};

/**
 * Historical fixes uploaded by E-331 after a link dropout. The last two sit
 * inside Z4, so the engine reconstructs a retroactive "Delayed Incident".
 */
export const E331_HISTORICAL_BATCH = [
  { position: [81.118, 8.145], recordedAt: Date.parse('2026-10-09T11:20:00Z') },
  { position: [81.105, 8.13], recordedAt: Date.parse('2026-10-09T12:05:00Z') },
  { position: [81.092, 8.116], recordedAt: Date.parse('2026-10-09T12:50:00Z') },
  { position: [81.086, 8.101], recordedAt: Date.parse('2026-10-09T13:35:00Z') }
];

const SIGNAL_LOST_AFTER_TICKS = 2;
const RECONNECT_AFTER_TICKS = 5;
const DEFAULT_INTERVAL_MS = 3000;

/** Deterministic pseudo-random walk so repeated demos look identical. */
function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000) / 1000 - 0.5;
  };
}

export default class MockTelemetryGateway {
  constructor(collars, { intervalMs = DEFAULT_INTERVAL_MS, seed = 20261009 } = {}) {
    this.collars = collars;
    this.intervalMs = intervalMs;
    this.random = createRandom(seed);
    this.listeners = new Set();
    this.timer = null;
    this.tickCount = 0;
    this.trackIndex = new Map();
    this.offlineTicks = new Map();
    this.wander = new Map(collars.map((collar) => [collar.collarId, { ...collar.position }]));
  }

  /** Observer registration (maintains the GeofenceEngine -> AlertService link). */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    if (this.timer) return this;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this;
  }

  /** Emits one round of collar fixes. Exposed for deterministic tests. */
  tick() {
    this.tickCount += 1;
    const events = [];

    for (const collar of this.collars) {
      if (collar.collarId === 'E-331') continue; // handled by the batch upload path
      events.push(...this.eventFor(collar));
    }

    events.push(...this.signalLossEvents());

    for (const event of events) {
      for (const listener of this.listeners) listener(event);
    }
    return events;
  }

  eventFor(collar) {
    if (collar.collarId === 'E-512') {
      // Stays offline, then reconnects with nothing to backfill.
      return [];
    }

    const track = LIVE_TRACKS[collar.collarId];
    if (track) {
      const index = this.trackIndex.get(collar.collarId) ?? 0;
      const position = track[Math.min(index, track.length - 1)];
      this.trackIndex.set(collar.collarId, index + 1);
      return [{ type: 'fix', collar: { ...collar, position }, at: new Date() }];
    }

    const last = this.wander.get(collar.collarId);
    const position = [last[0] + this.random() * 0.004, last[1] + this.random() * 0.003];
    this.wander.set(collar.collarId, position);
    return [{ type: 'fix', collar: { ...collar, position }, at: new Date() }];
  }

  /** Raises Signal Lost, then the reconnect that triggers a batch replay. */
  signalLossEvents() {
    if (this.tickCount === SIGNAL_LOST_AFTER_TICKS) {
      return [
        {
          type: 'signal_lost',
          collarId: 'E-512',
          reason: 'Gateway heartbeat timeout',
          at: new Date()
        }
      ];
    }

    if (this.tickCount === RECONNECT_AFTER_TICKS) {
      return [
        {
          type: 'signal_restored',
          collarId: 'E-331',
          batch: E331_HISTORICAL_BATCH,
          at: new Date()
        }
      ];
    }

    return [];
  }
}