// Human-friendly timestamps for the My Reports list. Pure functions so the
// screen stays presentational and this can be unit-tested in node.

/** "just now", "12 min ago", "3 h ago", or a date once it is older than a day. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}
