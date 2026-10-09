import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const Collar = require('../../models/Collar');
const BoundaryAlert = require('../../models/BoundaryAlert');
const AuditEntry = require('../../models/AuditEntry');
const DispatchAttempt = require('../../models/DispatchAttempt');
const Counter = require('../../models/Counter');
const Geofence = require('../../models/Geofence');
const Park = require('../../models/Park');
const alertService = require('../../services/alertService');
const TelemetryGatewaySimulator = require('../../services/telemetrySimulator');

const MODELS = { Collar, BoundaryAlert, AuditEntry, DispatchAttempt, Counter, Geofence, Park };
const originals = {};
for (const [name, model] of Object.entries(MODELS)) originals[name] = { ...model };

const withSave = (collar) => ({ ...collar, save: vi.fn(() => Promise.resolve(collar)) });

const E402_RAW = {
  collarId: 'E-402',
  gpsDeviceId: 'GPS-8841',
  species: 'African Elephant',
  sex: 'Female',
  health: 'Stable',
  speciesRisk: 'high',
  status: 'active',
  lastKnownLocation: { type: 'Point', coordinates: [81.06, 8.24] }
};
const E402 = withSave(E402_RAW);
const E512 = withSave({ ...E402, collarId: 'E-512', status: 'active', lastKnownLocation: { type: 'Point', coordinates: [81.15, 8.278] } });
const E331 = withSave({ ...E402, collarId: 'E-331', status: 'active', lastKnownLocation: { type: 'Point', coordinates: [81.09, 8.2] } });
const E455 = withSave({ ...E402, collarId: 'E-455', species: 'Sri Lankan Leopard', lastKnownLocation: { type: 'Point', coordinates: [81.072, 8.19] } });

let spies;

beforeEach(() => {
  spies = {
    // the simulator calls Collar.find().lean()
    // Deep-clone the coordinates: ingestFix rewrites lastKnownLocation, and a
    // shared array would let one simulator's walk leak into the next.
    collarFind: vi.fn(() => ({
      lean: () => Promise.resolve([E402, E512, E331, E455].map((c) => ({
        ...c,
        lastKnownLocation: { type: 'Point', coordinates: [...c.lastKnownLocation.coordinates] }
      })))
    })),
    collarUpdateOne: vi.fn(() => Promise.resolve({})),
    // ingestFix rewrites lastKnownLocation on the document it is given, so
    // hand back a copy rather than the shared fixture.
    collarFindOne: vi.fn(({ collarId }) => {
      const found = [E402, E512, E331, E455].find((c) => c.collarId === collarId);
      if (!found) return Promise.resolve(null);
      return Promise.resolve({
        ...found,
        lastKnownLocation: { type: 'Point', coordinates: [...found.lastKnownLocation.coordinates] }
      });
    }),
    alertFind: vi.fn(() => ({ sort: () => ({ lean: () => Promise.resolve([]) }) })),
    alertCreate: vi.fn((doc) => Promise.resolve(doc)),
    auditCreate: vi.fn(() => Promise.resolve({})),
    counterFindOneAndUpdate: vi.fn(() => Promise.resolve({ seq: 1 })),
    // loadGeofenceContext runs on every tick; default to no zones.
    geofenceFind: vi.fn(() => ({ lean: () => Promise.resolve([]) })),
    parkFindOne: vi.fn(() => ({ lean: () => Promise.resolve({ parkId: 'KNP', settlements: [] }) }))
  };
  Object.assign(Collar, {
    find: spies.collarFind,
    findOne: spies.collarFindOne,
    updateOne: spies.collarUpdateOne
  });
  Object.assign(BoundaryAlert, { find: spies.alertFind, create: spies.alertCreate });
  Object.assign(AuditEntry, { create: spies.auditCreate });
  Object.assign(Counter, { findOneAndUpdate: spies.counterFindOneAndUpdate });
  Object.assign(Geofence, { find: spies.geofenceFind });
  Object.assign(Park, { findOne: spies.parkFindOne });
});

afterEach(() => {
  for (const [name, model] of Object.entries(MODELS)) {
    for (const [key, value] of Object.entries(originals[name])) {
      if (value !== undefined) model[key] = value;
    }
  }
});

describe('MockTelemetryGateway', () => {
  it('emits a fix for every transmitting collar', async () => {
    const sim = new TelemetryGatewaySimulator();
    const fixes = await sim.tick();
    // E-331 is excluded because it is served by the batch replay path.
    expect(fixes.map((f) => f.collarId).sort()).toEqual(['E-402', 'E-455', 'E-512']);
    for (const fix of fixes) {
      expect(fix.coordinates).toHaveLength(2);
      expect(fix.at).toBeInstanceOf(Date);
    }
  });

  it('walks E-402 west along its scripted track', async () => {
    const sim = new TelemetryGatewaySimulator();
    const seen = [];
    for (let i = 0; i < 5; i += 1) {
      const fixes = await sim.tick();
      seen.push(fixes.find((f) => f.collarId === 'E-402').coordinates);
    }
    // Each step moves west, carrying it out of the park into Z1.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i][0]).toBeLessThan(seen[i - 1][0]);
    }
    expect(seen[0][0]).toBeCloseTo(81.06, 3);
  });

  it('clamps at the end of the track rather than running off the map', async () => {
    const sim = new TelemetryGatewaySimulator();
    for (let i = 0; i < 8; i += 1) await sim.tick();
    const fixes = await sim.tick();
    expect(fixes.find((f) => f.collarId === 'E-402').coordinates[0]).toBeCloseTo(81.012, 3);
  });

  it('stays reproducible across runs with the same seed', async () => {
    const first = new TelemetryGatewaySimulator({ seed: 42 });
    const second = new TelemetryGatewaySimulator({ seed: 42 });
    const a = await first.tick();
    const b = await second.tick();
    expect(a.find((f) => f.collarId === 'E-455').coordinates)
      .toEqual(b.find((f) => f.collarId === 'E-455').coordinates);
  });

  it('skips a collar that is already flagged signal lost', async () => {
    spies.collarFind.mockReturnValue({
      lean: () => Promise.resolve([
        withSave({ ...E402_RAW, status: 'signal_lost' }),
        withSave({ ...E402_RAW, collarId: 'E-512', status: 'active' })
      ])
    });
    const sim = new TelemetryGatewaySimulator();
    const fixes = await sim.tick();
    expect(fixes.map((f) => f.collarId)).toEqual(['E-512']);
  });

  it('raises Signal Lost on the scheduled tick and audits it', async () => {
    const sim = new TelemetryGatewaySimulator();
    sim.tickCount = 1; // the next tick is number 2
    await sim.tick();

    expect(spies.collarUpdateOne).toHaveBeenCalledWith(
      { collarId: 'E-512' },
      { $set: { status: 'signal_lost' } }
    );
    expect(spies.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SIGNAL_LOST', detail: expect.stringContaining('E-512') })
    );
  });

  it('stops emitting for a collar it has taken offline', async () => {
    const sim = new TelemetryGatewaySimulator();
    sim.tickCount = 1;
    await sim.tick();
    const fixes = await sim.tick();
    expect(fixes.map((f) => f.collarId)).not.toContain('E-512');
  });

  it('replays the historical batch when E-331 reconnects', async () => {
    const sim = new TelemetryGatewaySimulator();
    sim.tickCount = 4; // the next tick is number 5
    await sim.tick();

    expect(spies.collarUpdateOne).toHaveBeenCalledWith(
      { collarId: 'E-512' },
      { $set: { status: 'active' } }
    );
    // The replayed fixes must all be addressed to E-331 and marked delayed.
    // The replayed fixes are the E-331 historical batch.
    expect(TelemetryGatewaySimulator.E331_HISTORICAL_BATCH).toHaveLength(4);
    for (const entry of TelemetryGatewaySimulator.E331_HISTORICAL_BATCH) {
      expect(entry.position).toHaveLength(2);
      expect(entry.minutesAgo).toBeGreaterThan(0);
    }
  });

  it('does not replay the batch on any other tick', async () => {
    const sim = new TelemetryGatewaySimulator();
    sim.tickCount = 6;
    spies.collarUpdateOne.mockClear();
    await sim.tick();
    expect(spies.collarUpdateOne).not.toHaveBeenCalled();
  });

  it('starts and stops its interval without leaking a timer', () => {
    vi.useFakeTimers();
    const sim = new TelemetryGatewaySimulator({ intervalMs: 1000 });
    sim.start();
    expect(sim.timer).not.toBeNull();
    sim.stop();
    expect(sim.timer).toBeNull();
    // Starting twice must not create a second interval.
    sim.start();
    sim.start();
    const first = sim.timer;
    sim.stop();
    expect(first).not.toBeNull();
    vi.useRealTimers();
  });

  it('never runs two ticks at once', async () => {
    vi.useFakeTimers();
    const sim = new TelemetryGatewaySimulator({ intervalMs: 10 });
    let inFlight = 0;
    let overlapped = false;
    const originalTick = sim.tick.bind(sim);
    sim.tick = async () => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      return originalTick();
    };

    sim.start();
    await vi.advanceTimersByTimeAsync(200);
    sim.stop();
    vi.useRealTimers();

    expect(overlapped).toBe(false);
  });

  it('keeps running after a tick throws', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sim = new TelemetryGatewaySimulator({ intervalMs: 10 });
    let calls = 0;
    sim.tick = async () => { calls += 1; throw new Error('gateway down'); };

    sim.start();
    await vi.advanceTimersByTimeAsync(60);
    sim.stop();
    vi.useRealTimers();

    expect(calls).toBeGreaterThan(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('ingesting simulated telemetry', () => {
  it('raises an alert once the scripted walk crosses into Z1', async () => {
    Geofence.find = vi.fn(() => ({
      lean: () => Promise.resolve([{
        zoneId: 'Z1',
        name: 'Elephant Corridor',
        gridRef: 'G7',
        kind: 'farmland',
        threatLevel: 'critical',
        polygon: [
          [81.03, 8.196], [81.005, 8.205], [80.972, 8.228], [80.952, 8.262],
          [80.968, 8.292], [81.008, 8.288], [81.034, 8.258], [81.038, 8.222],
          [81.03, 8.196]
        ]
      }])
    }));
    Park.findOne = vi.fn(() => ({
      lean: () => Promise.resolve({ parkId: 'KNP', settlements: [] })
    }));

    const sim = new TelemetryGatewaySimulator();
    for (let i = 0; i < 4; i += 1) await sim.tick();

    // Each fix is persisted and the breach is evaluated on the server.
    expect(spies.alertCreate).toHaveBeenCalled();
    const created = spies.alertCreate.mock.calls[0][0];
    expect(created.collarId).toBe('E-402');
    expect(created.zoneId).toBe('Z1');
    expect(created.gridRef).toBe('G7');
  });
});
