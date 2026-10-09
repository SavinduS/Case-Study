const Collar = require('../models/Collar');
const { ingestBatch, writeAudit } = require('./alertService');
const { AUDIT_ACTION, COLLAR_STATUS } = require('../utils/collarAlertConstants');

/**
 * TelemetryGatewaySimulator
 *
 * Stands in for the physical GPS collars and the IoT/satellite gateway that
 * would normally post to POST /api/telemetry/fixes. It runs on the server so
 * the browser holds no simulated data - the dashboard only ever sees what the
 * database says.
 *
 * It drives the three ingestion paths in the use case:
 *   - live periodic fixes (main flow, step 1)
 *   - a collar that drops to Signal Lost (exception flow 1)
 *   - a batch replay of historical fixes after reconnecting (alternate flow D)
 *
 * Tracks are scripted and the walk is seeded, so a demo reproduces the same
 * breach every run.
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
  'E-331': [
    [81.09, 8.2],
    [81.094, 8.196]
  ]
};

/** Historical fixes replayed after E-331 reconnects; the last two breach Z4. */
const E331_HISTORICAL_BATCH = [
  { position: [81.118, 8.145], minutesAgo: 145 },
  { position: [81.105, 8.13], minutesAgo: 100 },
  { position: [81.092, 8.116], minutesAgo: 55 },
  { position: [81.086, 8.101], minutesAgo: 10 }
];

const SIGNAL_LOST_TICK = 2;
const RECONNECT_TICK = 5;
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

class TelemetryGatewaySimulator {
  constructor({ intervalMs = DEFAULT_INTERVAL_MS, seed = 20261009 } = {}) {
    this.intervalMs = intervalMs;
    this.random = createRandom(seed);
    this.timer = null;
    this.tickCount = 0;
    this.running = false;
    this.trackIndex = new Map();
    this.offline = new Set();
    this.wander = new Map();
  }

  start() {
    if (this.timer) return this;
    this.timer = setInterval(() => {
      // setInterval does not wait for an async callback, so without this
      // guard a slow tick (Atlas latency) lets the next one start while it
      // is still running. Concurrent ingests then race each other.
      if (this.running) return;
      this.running = true;
      this.tick()
        .catch((error) => console.error('[telemetry] tick failed:', error.message))
        .finally(() => { this.running = false; });
    }, this.intervalMs);
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this;
  }

  async tick() {
    this.tickCount += 1;
    const at = new Date();

    const collars = await Collar.find({}).lean();
    const fixes = [];
    for (const collar of collars) {
      if (collar.collarId === 'E-331') continue; // handled by the replay path
      if (this.offline.has(collar.collarId)) continue;
      if (collar.status === COLLAR_STATUS.SIGNAL_LOST) continue;
      fixes.push(this.fixFor(collar, at));
    }

    if (fixes.length > 0) {
      await ingestBatch(fixes.map((f) => ({ collarId: f.collarId, coordinates: f.coordinates, at })));
    }

    await this.signalLossEvents(at);
    return fixes;
  }

  fixFor(collar, at) {
    const track = LIVE_TRACKS[collar.collarId];
    if (track) {
      const index = this.trackIndex.get(collar.collarId) ?? 0;
      const coordinates = track[Math.min(index, track.length - 1)];
      this.trackIndex.set(collar.collarId, index + 1);
      return { collarId: collar.collarId, coordinates, at };
    }

    if (!this.wander.has(collar.collarId)) {
      this.wander.set(collar.collarId, collar.lastKnownLocation.coordinates);
    }
    const [lng, lat] = this.wander.get(collar.collarId);
    const coordinates = [lng + this.random() * 0.004, lat + this.random() * 0.003];
    this.wander.set(collar.collarId, coordinates);
    return { collarId: collar.collarId, coordinates, at };
  }

  /** Raises Signal Lost, then the reconnect that triggers the batch replay. */
  async signalLossEvents(at) {
    if (this.tickCount === SIGNAL_LOST_TICK) {
      this.offline.add('E-512');
      await Collar.updateOne({ collarId: 'E-512' }, { $set: { status: COLLAR_STATUS.SIGNAL_LOST } });
      await writeAudit({
        action: AUDIT_ACTION.SIGNAL_LOST,
        actor: 'CollarGateway',
        detail: 'Telemetry link lost for E-512: Gateway heartbeat timeout.',
        at
      });
      return;
    }

    if (this.tickCount === RECONNECT_TICK) {
      this.offline.delete('E-512');
      await Collar.updateOne({ collarId: 'E-512' }, { $set: { status: COLLAR_STATUS.ACTIVE } });

      // Alternate flow D: replay recorded timestamps as delayed incidents.
      const fixes = E331_HISTORICAL_BATCH.map((entry) => ({
        collarId: 'E-331',
        coordinates: entry.position,
        at: new Date(Date.now() - entry.minutesAgo * 60 * 1000),
        delayed: true
      }));
      await ingestBatch(fixes, { delayed: true });
    }
  }
}

module.exports = TelemetryGatewaySimulator;
module.exports.E331_HISTORICAL_BATCH = E331_HISTORICAL_BATCH;