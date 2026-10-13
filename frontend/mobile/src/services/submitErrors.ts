import { ApiError } from '../api/client';
import { StorageFullError } from './incidentStorage';

/**
 * Map a submit failure to the message shown on Review (pure, unit-tested).
 * Storage-full keeps the draft for retry; rejections surface the server
 * message; anything else falls back to a generic retry prompt.
 */
export function mapSubmitError(e: unknown): string {
  if (e instanceof StorageFullError) return e.message;
  if (e instanceof ApiError) return String(e.message || 'The report was rejected. Check the highlighted fields.');
  if (e instanceof Error) return e.message || 'Could not save the report. Try again.';
  return 'Could not save the report. Try again.';
}
