import { isValidReportId, newReportId } from '../services/reportId';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('reportId (stable UUID for field incidents)', () => {
  it('generates UUID v4 values the backend accepts', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(newReportId()).toMatch(UUID_RE);
    }
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newReportId()));
    expect(ids.size).toBe(100);
  });

  it('validates reportId strings like the backend', () => {
    expect(isValidReportId(newReportId())).toBe(true);
    expect(isValidReportId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    for (const bad of ['', '   ', 'not-a-uuid', 'local-123', null, undefined, 42]) {
      expect(isValidReportId(bad)).toBe(false);
    }
  });
});
