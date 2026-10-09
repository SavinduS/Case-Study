import { describe, it, expect } from 'vitest';
const {
  isValidLngLat,
  haversineDistanceMeters,
  pointInPolygon,
  distanceToSegmentMeters,
  distanceToPolygonMeters
} = require('../utils/geo');

/** Unit square around [80, 8] spanning 0.1 degrees. */
const SQUARE = [
  [80.0, 8.0],
  [80.1, 8.0],
  [80.1, 8.1],
  [80.0, 8.1],
  [80.0, 8.0]
];

describe('isValidLngLat', () => {
  it('accepts real coordinates', () => {
    expect(isValidLngLat(81.036, 8.241)).toBe(true);
    expect(isValidLngLat(0, 0)).toBe(true);
  });

  it('accepts the exact range boundaries', () => {
    expect(isValidLngLat(-180, -90)).toBe(true);
    expect(isValidLngLat(180, 90)).toBe(true);
  });

  it('rejects values just outside the range', () => {
    expect(isValidLngLat(180.0001, 0)).toBe(false);
    expect(isValidLngLat(-180.0001, 0)).toBe(false);
    expect(isValidLngLat(0, 90.0001)).toBe(false);
    expect(isValidLngLat(0, -90.0001)).toBe(false);
  });

  it('rejects non-numeric input rather than coercing it', () => {
    // A telemetry gateway posting "81.0" as a string must not be accepted.
    expect(isValidLngLat('81.0', 8.2)).toBe(false);
    expect(isValidLngLat(81, null)).toBe(false);
    expect(isValidLngLat(NaN, 8)).toBe(false);
    expect(isValidLngLat(undefined, undefined)).toBe(false);
  });
});

describe('haversineDistanceMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineDistanceMeters([81.0, 8.2], [81.0, 8.2])).toBe(0);
  });

  it('measures a known distance: one degree of latitude is ~111 km', () => {
    const metres = haversineDistanceMeters([0, 0], [0, 1]);
    expect(metres).toBeGreaterThan(110_000);
    expect(metres).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const a = haversineDistanceMeters([80.9, 8.1], [81.1, 8.3]);
    const b = haversineDistanceMeters([81.1, 8.3], [80.9, 8.1]);
    expect(a).toBeCloseTo(b, 6);
  });

  it('measures the hop from the park edge to the village it threatens', () => {
    // Western park edge to Kiri Veedi, just under 10 km as the crow flies.
    const metres = haversineDistanceMeters([81.0, 8.235], [80.958, 8.156]);
    expect(metres).toBeGreaterThan(9_000);
    expect(metres).toBeLessThan(11_000);
  });
});

describe('pointInPolygon', () => {
  it('detects a point inside', () => {
    expect(pointInPolygon([80.05, 8.05], SQUARE)).toBe(true);
  });

  it('detects a point outside', () => {
    expect(pointInPolygon([80.5, 8.5], SQUARE)).toBe(false);
    expect(pointInPolygon([80.05, 7.5], SQUARE)).toBe(false);
  });

  it('treats a vertex as inside and a far edge as outside', () => {
    expect(pointInPolygon([80.0, 8.0], SQUARE)).toBe(true);
    expect(pointInPolygon([80.2, 8.05], SQUARE)).toBe(false);
  });

  it('handles a concave polygon by not filling the notch', () => {
    // A "C" shape opening to the right; the notch must read as outside.
    const c = [
      [0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [3, 2], [3, 3], [0, 3], [0, 0]
    ];
    expect(pointInPolygon([0.5, 1.5], c)).toBe(true);
    expect(pointInPolygon([2.5, 1.5], c)).toBe(false);
  });
});

describe('distanceToSegmentMeters', () => {
  it('is zero on the segment', () => {
    expect(distanceToSegmentMeters([80.05, 8.0], [80.0, 8.0], [80.1, 8.0])).toBeLessThan(1);
  });

  it('measures the perpendicular offset', () => {
    // 0.01 degrees of latitude is about 1.1 km.
    const metres = distanceToSegmentMeters([80.05, 8.01], [80.0, 8.0], [80.1, 8.0]);
    expect(metres).toBeGreaterThan(1_000);
    expect(metres).toBeLessThan(1_200);
  });

  it('falls back to the nearest endpoint beyond the segment ends', () => {
    // Equirectangular and great-circle distances agree closely but not
    // exactly, so compare within the approximation's tolerance.
    const beyond = distanceToSegmentMeters([80.3, 8.0], [80.0, 8.0], [80.1, 8.0]);
    const endpoint = haversineDistanceMeters([80.3, 8.0], [80.1, 8.0]);
    expect(Math.abs(beyond - endpoint) / endpoint).toBeLessThan(0.01);
  });

  it('does not divide by zero when the segment has no length', () => {
    expect(Number.isFinite(distanceToSegmentMeters([80.05, 8.05], [80.0, 8.0], [80.0, 8.0]))).toBe(true);
  });
});

describe('distanceToPolygonMeters', () => {
  it('is zero for a point inside', () => {
    // Inside, so the measurement is the distance to the nearest edge.
    expect(distanceToPolygonMeters([80.05, 8.05], SQUARE)).toBeLessThan(6_000);
  });

  it('measures how far outside a point lies', () => {
    // 0.02 degrees east of the eastern edge (80.1) is roughly 2.2 km.
    const metres = distanceToPolygonMeters([80.12, 8.05], SQUARE);
    expect(metres).toBeGreaterThan(2_000);
    expect(metres).toBeLessThan(2_500);
  });

  it('takes the shortest edge, not the first one', () => {
    // 0.002 deg east of the eastern edge, versus 0.05 deg north of the
    // northern edge: the first point is much closer to the ring.
    const near = distanceToPolygonMeters([80.102, 8.05], SQUARE);
    const far = distanceToPolygonMeters([80.05, 8.15], SQUARE);
    expect(near).toBeLessThan(far);
  });
});
