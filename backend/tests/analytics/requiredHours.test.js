const { mergeRequiredHours, DEFAULT_REQUIRED_HOURS } = require('../../services/analyticsService');
const { SECTORS } = require('../../config/areas');

// Member 2 — patrol targets behind every coverage % (database first,
// server env fallback, built-in default last).
describe('zone required hours', () => {
  test('falls back to the default target when nothing is stored or configured', () => {
    const merged = mergeRequiredHours([], {});
    SECTORS.forEach((s) => expect(merged[s.code]).toBe(DEFAULT_REQUIRED_HOURS));
  });

  test('prefers database values over env values', () => {
    const merged = mergeRequiredHours(
      [{ code: 'northboundary', requiredHours: 12 }],
      { NORTHBOUNDARY: 40, EASTBOUNDARY: 20 }
    );
    expect(merged.NORTHBOUNDARY).toBe(12);
    expect(merged.EASTBOUNDARY).toBe(20);
  });

  test('ignores invalid stored values and uses the default', () => {
    const merged = mergeRequiredHours([{ code: SECTORS[0].code, requiredHours: 'oops' }], {});
    expect(merged[SECTORS[0].code]).toBe(DEFAULT_REQUIRED_HOURS);
  });
});
