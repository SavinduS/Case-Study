import { describe, expect, it } from 'vitest';
import { relativeTime } from '../../src/utils/time';

const NOW = new Date('2026-06-15T12:00:00Z').getTime();

function iso(minutesAgo: number): string {
  return new Date(NOW - minutesAgo * 60000).toISOString();
}

describe('relativeTime (My Reports list)', () => {
  it('says "just now" inside the first minute', () => {
    expect(relativeTime(iso(0), NOW)).toBe('just now');
    expect(relativeTime(iso(0.9), NOW)).toBe('just now');
  });

  it('counts minutes up to an hour', () => {
    expect(relativeTime(iso(5), NOW)).toBe('5 min ago');
    expect(relativeTime(iso(59), NOW)).toBe('59 min ago');
  });

  it('counts hours up to a day', () => {
    expect(relativeTime(iso(60), NOW)).toBe('1 h ago');
    expect(relativeTime(iso(5 * 60 + 30), NOW)).toBe('5 h ago');
    expect(relativeTime(iso(23 * 60), NOW)).toBe('23 h ago');
  });

  it('falls back to a date once it is a day or older', () => {
    const older = relativeTime(iso(24 * 60), NOW);
    expect(older).not.toMatch(/ago/);
    expect(older.length).toBeGreaterThan(0);
  });
});
