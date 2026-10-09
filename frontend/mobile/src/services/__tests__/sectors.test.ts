import { SECTORS, distanceMeters, sectorForPoint, sectorLabel } from '../sectors';

describe('sectors', () => {
  it('lists the four boundary sectors with unique codes', () => {
    expect(SECTORS).toHaveLength(4);
    const codes = SECTORS.map((s) => s.code);
    expect(codes).toEqual([
      'NORTHBOUNDARY',
      'EASTBOUNDARY',
      'SOUTHBOUNDARY',
      'WESTBOUNDARY'
    ]);
    expect(new Set(codes).size).toBe(4);
  });

  it('distanceMeters is ~0 for the same point and grows with separation', () => {
    const center: [number, number] = [81.42, 6.62];
    expect(distanceMeters(center, center)).toBeCloseTo(0, 5);
    const oneKmEast: [number, number] = [81.42913, 6.62];
    expect(distanceMeters(center, oneKmEast)).toBeGreaterThan(900);
    expect(distanceMeters(center, oneKmEast)).toBeLessThan(1100);
  });

  it('sectorForPoint finds the sector containing a point inside the radius', () => {
    expect(sectorForPoint(81.42, 6.62)?.code).toBe('NORTHBOUNDARY');
    expect(sectorForPoint(81.28, 6.48)?.code).toBe('WESTBOUNDARY');
  });

  it('sectorForPoint returns null far outside every sector', () => {
    expect(sectorForPoint(0, 0)).toBeNull();
  });

  it('sectorLabel returns the display name or null', () => {
    expect(sectorLabel(81.42, 6.62)).toBe('North Boundary');
    expect(sectorLabel(10, 10)).toBeNull();
  });
});
