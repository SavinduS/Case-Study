import { distanceMeters, sectorForPoint, sectorLabel, SECTORS } from '../services/sectors';

describe('services/sectors', () => {
  it('exposes four boundary sectors', () => {
    expect(SECTORS).toHaveLength(4);
    expect(SECTORS.map((s) => s.code)).toEqual(
      expect.arrayContaining(['NORTHBOUNDARY', 'EASTBOUNDARY', 'SOUTHBOUNDARY', 'WESTBOUNDARY'])
    );
  });

  it('distanceMeters is ~0 for identical points', () => {
    expect(distanceMeters([81.42, 6.62], [81.42, 6.62])).toBeCloseTo(0, 5);
  });

  it('distanceMeters grows with separation', () => {
    const near = distanceMeters([81.42, 6.62], [81.421, 6.621]);
    const far = distanceMeters([81.42, 6.62], [81.52, 6.5]);
    expect(far).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(0);
  });

  it('sectorForPoint finds the sector containing a center', () => {
    expect(sectorForPoint(81.42, 6.62)?.code).toBe('NORTHBOUNDARY');
    expect(sectorForPoint(81.52, 6.5)?.code).toBe('EASTBOUNDARY');
  });

  it('sectorForPoint returns null far away', () => {
    expect(sectorForPoint(0, 0)).toBeNull();
  });

  it('sectorLabel returns name or null', () => {
    expect(sectorLabel(81.42, 6.62)).toBe('North Boundary');
    expect(sectorLabel(0, 0)).toBeNull();
  });
});

