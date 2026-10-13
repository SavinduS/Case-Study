const { sectorForIncident } = require('../../services/analyticsService');
const { SECTORS, normalizeSectorCode } = require('../../config/areas');

// Member 2 — incident-to-sector assignment used by every zone breakdown.
describe('analytics sector assignment', () => {
  test('assigns an incident to the nearest configured sector', () => {
    const [lng, lat] = SECTORS[0].center;
    expect(sectorForIncident({ location: { coordinates: [lng, lat] } })).toBe(SECTORS[0].code);
  });

  test('returns null when the incident has no coordinates', () => {
    expect(sectorForIncident({})).toBeNull();
    expect(sectorForIncident({ location: {} })).toBeNull();
  });

  test('normalises zone codes with spaces, dashes and case', () => {
    expect(normalizeSectorCode('north boundary')).toBe('NORTHBOUNDARY');
    expect(normalizeSectorCode('east-boundary')).toBe('EASTBOUNDARY');
    expect(normalizeSectorCode('south_boundary')).toBe('SOUTHBOUNDARY');
  });
});
