import { describe, it, expect, beforeEach } from 'vitest';
const {
  evaluateZone,
  evaluateGeofence,
  findNearestRanger,
  distanceToNearestSettlementM,
  deriveSeverity,
  priorityScore,
  zoneKindLabel
} = require('../services/geofenceService');
const { THREAT_LEVEL, APPROACH_BUFFER_M } = require('../utils/collarAlertConstants');

const Z1 = {
  zoneId: 'Z1',
  name: 'Elephant Corridor - Western Farmland',
  gridRef: 'G7',
  kind: 'farmland',
  threatLevel: THREAT_LEVEL.CRITICAL,
  polygon: [
    [81.03, 8.196], [81.005, 8.205], [80.972, 8.228], [80.952, 8.262],
    [80.968, 8.292], [81.008, 8.288], [81.034, 8.258], [81.038, 8.222],
    [81.03, 8.196]
  ]
};

const MEDIUM_ZONE = {
  zoneId: 'Z4',
  name: 'Resettlement Plot Boundary',
  gridRef: 'D5',
  kind: 'farmland',
  threatLevel: THREAT_LEVEL.MEDIUM,
  polygon: [
    [81.06, 8.062], [81.1, 8.07], [81.128, 8.096], [81.12, 8.124],
    [81.086, 8.128], [81.06, 8.108], [81.052, 8.082], [81.06, 8.062]
  ]
};

const ZONES = [Z1, MEDIUM_ZONE];

/** A point in the middle of the park, clear of every zone. */
const SAFE_IN_PARK = [81.09, 8.19];

/**
 * Two deliberately overlapping zones used to prove that the engine reports
 * the more severe of several simultaneous breaches. The real seeded zones
 * do not overlap, and the approach buffer is too narrow to bridge the gap.
 */
const OVERLAPPING_ZONES = [
  { ...Z1, zoneId: 'CRIT', threatLevel: THREAT_LEVEL.CRITICAL },
  {
    ...MEDIUM_ZONE,
    zoneId: 'MED',
    polygon: [
      [80.97, 8.19], [81.1, 8.19], [81.1, 8.3], [80.97, 8.3], [80.97, 8.19]
    ]
  }
];

const SETTLEMENTS = [
  { settlementId: 'S1', name: 'Kiri Veedi', position: [80.958, 8.156] }
];

describe('evaluateZone', () => {
  it('reports a point well inside the zone', () => {
    const result = evaluateZone([80.99, 8.24], Z1);
    expect(result.breached).toBe(true);
    expect(result.isInside).toBe(true);
    expect(result.approaching).toBe(false);
    expect(result.depthInsideM).toBeGreaterThan(0);
    expect(result.zoneId).toBe('Z1');
    expect(result.gridRef).toBe('G7');
    expect(result.threatLevel).toBe(THREAT_LEVEL.CRITICAL);
  });

  it('reports a point well clear of the zone as safe', () => {
    const result = evaluateZone([81.1, 8.1], Z1);
    expect(result.breached).toBe(false);
    expect(result.isInside).toBe(false);
    expect(result.depthInsideM).toBe(0);
  });

  it('flags a point in the approach buffer without claiming a breach inside', () => {
    // Just outside the eastern edge of Z1.
    const justOutside = evaluateZone([81.0395, 8.24], Z1, 400);
    expect(justOutside.breached).toBe(true);
    expect(justOutside.isInside).toBe(false);
    expect(justOutside.approaching).toBe(true);
  });

  it('treats a zero buffer as "inside only"', () => {
    const justOutside = evaluateZone([81.0395, 8.24], Z1, 0);
    expect(justOutside.breached).toBe(false);
  });

  it('rounds its distance measurements to whole metres', () => {
    const result = evaluateZone([80.99, 8.24], Z1);
    expect(Number.isInteger(result.distanceToBoundaryM)).toBe(true);
    expect(Number.isInteger(result.depthInsideM)).toBe(true);
  });

  it('defaults to the configured approach buffer', () => {
    expect(APPROACH_BUFFER_M).toBe(400);
    const result = evaluateZone([81.0395, 8.24], Z1);
    expect(result.breached).toBe(true);
  });
});

describe('evaluateGeofence', () => {
  it('returns a safe result when no zone is breached', () => {
    const { safe, result } = evaluateGeofence(SAFE_IN_PARK, ZONES);
    expect(safe).toBe(true);
    expect(result).toBeNull();
  });

  it('returns the single breach when only one zone is hit', () => {
    const { safe, result } = evaluateGeofence([80.99, 8.24], ZONES);
    expect(safe).toBe(false);
    expect(result.zoneId).toBe('Z1');
  });

  it('prefers the more severe zone when several are breached', () => {
    // This point sits inside both fixtures, so both must be detected.
    const { all, result } = evaluateGeofence([80.99, 8.24], OVERLAPPING_ZONES);
    const breached = all.filter((r) => r.breached).map((r) => r.zoneId);
    expect(breached.sort()).toEqual(['CRIT', 'MED']);
    expect(result.zoneId).toBe('CRIT');
    expect(result.threatLevel).toBe(THREAT_LEVEL.CRITICAL);
  });

  it('evaluates every zone so the caller can see the full picture', () => {
    const { all } = evaluateGeofence([80.99, 8.24], ZONES);
    expect(all).toHaveLength(ZONES.length);
    expect(all.map((r) => r.zoneId).sort()).toEqual(['Z1', 'Z4']);
  });

  it('handles an empty zone list without throwing', () => {
    const { safe, result, all } = evaluateGeofence([81.1, 8.1], []);
    expect(safe).toBe(true);
    expect(result).toBeNull();
    expect(all).toEqual([]);
  });
});

describe('findNearestRanger', () => {
  const rangers = [
    { rangerId: 'RT-01', name: 'Kandy', status: 'available', position: [81.021, 8.191] },
    { rangerId: 'RT-02', name: 'Matale', status: 'available', position: [81.083, 8.243] },
    { rangerId: 'RT-03', name: 'Kurunegala', status: 'on_patrol', position: [80.985, 8.212] }
  ];

  it('picks the closest available team and reports the distance', () => {
    // Kandy is roughly 5.8 km away here, Matale about 7.9 km.
    const nearest = findNearestRanger([81.012, 8.243], rangers);
    expect(nearest.rangerId).toBe('RT-01');
    expect(nearest.distanceM).toBeGreaterThan(5_000);
    expect(nearest.distanceM).toBeLessThan(6_500);
  });

  it('picks the eastern team when the breach is in the east', () => {
    expect(findNearestRanger([81.08, 8.24], rangers).rangerId).toBe('RT-02');
  });

  it('never dispatches a team that is on patrol', () => {
    // Kurunegala is closest to this point but is not available.
    const nearest = findNearestRanger([80.99, 8.215], rangers);
    expect(nearest.rangerId).not.toBe('RT-03');
  });

  it('returns null when every team is unavailable', () => {
    const busy = rangers.map((r) => ({ ...r, status: 'dispatched' }));
    expect(findNearestRanger([81.0, 8.24], busy)).toBeNull();
  });

  it('returns null for an empty roster', () => {
    expect(findNearestRanger([81.0, 8.24], [])).toBeNull();
  });
});

describe('distanceToNearestSettlementM', () => {
  it('measures the distance to the closest settlement', () => {
    // Kiri Veedi lies about 10 km south-west of this breach point.
    const metres = distanceToNearestSettlementM([80.99, 8.24], SETTLEMENTS);
    expect(metres).toBeGreaterThan(9_000);
    expect(metres).toBeLessThan(11_000);
  });

  it('picks the closest of several settlements', () => {
    const near = [{ settlementId: 'A', name: 'Near', position: [80.995, 8.24] }];
    const withBoth = [...SETTLEMENTS, ...near];
    expect(distanceToNearestSettlementM([80.99, 8.24], withBoth))
      .toBeLessThan(distanceToNearestSettlementM([80.99, 8.24], SETTLEMENTS));
  });

  it('returns null when there are no settlements to compare against', () => {
    expect(distanceToNearestSettlementM([80.99, 8.24], [])).toBeNull();
  });
});

describe('deriveSeverity', () => {
  const base = { threatLevel: THREAT_LEVEL.MEDIUM, isInside: false, depthInsideM: 0, distanceToBoundaryM: 100 };

  it('keeps the zone threat level while the animal is only approaching', () => {
    expect(deriveSeverity({ ...base })).toBe(THREAT_LEVEL.MEDIUM);
  });

  it('raises to at least high once the animal is inside', () => {
    expect(deriveSeverity({ ...base, isInside: true, depthInsideM: 100 })).toBe(THREAT_LEVEL.HIGH);
  });

  it('escalates one step further when deeply inside', () => {
    expect(deriveSeverity({ ...base, isInside: true, depthInsideM: 2_000 })).toBe(THREAT_LEVEL.CRITICAL);
  });

  it('never escalates above critical, however deep the breach', () => {
    const deepCritical = {
      threatLevel: THREAT_LEVEL.CRITICAL,
      isInside: true,
      depthInsideM: 50_000
    };
    expect(deriveSeverity(deepCritical)).toBe(THREAT_LEVEL.CRITICAL);
  });

  it('escalates a high or critical zone to critical near a settlement', () => {
    const high = { threatLevel: THREAT_LEVEL.HIGH, isInside: true, depthInsideM: 100 };
    expect(deriveSeverity(high, { distanceToSettlementM: 500 })).toBe(THREAT_LEVEL.CRITICAL);
  });

  it('leaves a medium zone at high near a settlement rather than over-escalating', () => {
    expect(deriveSeverity({ ...base, isInside: true, depthInsideM: 50 }, { distanceToSettlementM: 500 }))
      .toBe(THREAT_LEVEL.HIGH);
  });

  it('does not escalate when the settlement is far away', () => {
    expect(deriveSeverity({ threatLevel: THREAT_LEVEL.HIGH, isInside: true, depthInsideM: 50 }, { distanceToSettlementM: 9_000 }))
      .toBe(THREAT_LEVEL.HIGH);
  });

  it('treats a missing settlement distance as far away', () => {
    expect(deriveSeverity({ threatLevel: THREAT_LEVEL.HIGH, isInside: true, depthInsideM: 50 }, { distanceToSettlementM: null }))
      .toBe(THREAT_LEVEL.HIGH);
  });

  it('is monotonic: severity never decreases as the breach deepens', () => {
    const ranks = { low: 1, medium: 2, high: 3, critical: 4 };
    let previous = 0;
    for (const depth of [0, 100, 600, 1_000, 5_000, 20_000]) {
      const severity = deriveSeverity({
        threatLevel: THREAT_LEVEL.MEDIUM,
        isInside: depth > 0,
        depthInsideM: depth
      }, { distanceToSettlementM: 9_000 });
      expect(ranks[severity]).toBeGreaterThanOrEqual(previous);
      previous = ranks[severity];
    }
  });

  it('returns low for a missing result rather than throwing', () => {
    expect(deriveSeverity(null)).toBe(THREAT_LEVEL.LOW);
    expect(deriveSeverity(undefined)).toBe(THREAT_LEVEL.LOW);
  });
});

describe('priorityScore', () => {
  it('scores a critical alert above a medium one', () => {
    const critical = priorityScore({ threatLevel: 'critical', distanceToSettlementM: 5_000, speciesRisk: 'high', delayed: false });
    const medium = priorityScore({ threatLevel: 'medium', distanceToSettlementM: 5_000, speciesRisk: 'high', delayed: false });
    expect(critical).toBeGreaterThan(medium);
  });

  it('scores a breach nearer a settlement above one further away', () => {
    const near = priorityScore({ threatLevel: 'high', distanceToSettlementM: 200, speciesRisk: 'medium', delayed: false });
    const far = priorityScore({ threatLevel: 'high', distanceToSettlementM: 5_900, speciesRisk: 'medium', delayed: false });
    expect(near).toBeGreaterThan(far);
  });

  it('scores a high animal-conflict risk above a low one', () => {
    const high = priorityScore({ threatLevel: 'high', distanceToSettlementM: 3_000, speciesRisk: 'high', delayed: false });
    const low = priorityScore({ threatLevel: 'high', distanceToSettlementM: 3_000, speciesRisk: 'low', delayed: false });
    expect(high).toBeGreaterThan(low);
  });

  it('deprioritises a delayed incident so live breaches are handled first', () => {
    const live = priorityScore({ threatLevel: 'high', distanceToSettlementM: 1_000, speciesRisk: 'high', delayed: false });
    const delayed = priorityScore({ threatLevel: 'high', distanceToSettlementM: 1_000, speciesRisk: 'high', delayed: true });
    expect(live).toBeGreaterThan(delayed);
  });

  it('is safe when the settlement distance is unknown', () => {
    const score = priorityScore({ threatLevel: 'high', distanceToSettlementM: null, speciesRisk: 'medium', delayed: false });
    expect(Number.isFinite(score)).toBe(true);
  });

  it('returns a whole number', () => {
    const score = priorityScore({ threatLevel: 'high', distanceToSettlementM: 1_234, speciesRisk: 'high', delayed: false });
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('zoneKindLabel', () => {
  it.each([
    ['farmland', 'farmland'],
    ['village', 'village'],
    ['road', 'road'],
    ['settlement', 'high-risk'],
    [undefined, 'high-risk']
  ])('maps %s to %s', (input, expected) => {
    expect(zoneKindLabel(input)).toBe(expected);
  });
});

describe('GeofenceEngine with the seeded park', () => {
  let savedAlerts;

  beforeEach(() => {
    savedAlerts = [];
  });

  it('breaches Z1 as an animal walks west out of the park', () => {
    // The scripted track used by the telemetry simulator.
    const track = [
      [81.06, 8.24],
      [81.048, 8.24],
      [81.036, 8.241],
      [81.024, 8.242],
      [81.012, 8.243]
    ];
    const results = track.map((position) => evaluateGeofence(position, ZONES).result);
    savedAlerts = results.filter(Boolean);

    expect(savedAlerts).toHaveLength(3);
    expect(savedAlerts.every((r) => r.zoneId === 'Z1')).toBe(true);
    // The approach is detected before the animal is fully across.
    expect(results[2].isInside).toBe(false);
    expect(results[3].isInside).toBe(true);
  });

  it('leaves a collar in the middle of the park alone', () => {
    const { safe } = evaluateGeofence(SAFE_IN_PARK, ZONES);
    expect(safe).toBe(true);
  });
});
