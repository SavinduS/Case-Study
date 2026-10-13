import { mapSubmitError } from '../services/submitErrors';
import { ApiError } from '../api/client';
import { StorageFullError } from '../services/incidentStorage';

describe('mapSubmitError (submit -> message mapping)', () => {
  it('passes a storage-full message through so the draft can retry', () => {
    const err = new StorageFullError('Storage limit reached (100 reports). Sync or remove old reports.');
    expect(mapSubmitError(err)).toBe(err.message);
  });

  it('surfaces the server rejection message for ApiError', () => {
    expect(mapSubmitError(new ApiError(400, { message: 'Validation failed' }))).toBe(
      'Validation failed'
    );
  });

  it('uses the ApiError status message when the payload has none', () => {
    // ApiError always builds a message in its constructor, so a payload
    // without one surfaces as "Request failed (<status>)".
    expect(mapSubmitError(new ApiError(422, {}))).toBe('Request failed (422)');
  });

  it('surfaces plain Error messages', () => {
    expect(mapSubmitError(new Error('disk hiccup'))).toBe('disk hiccup');
  });

  it('falls back to the retry prompt for an empty Error', () => {
    expect(mapSubmitError(new Error(''))).toBe('Could not save the report. Try again.');
  });

  it.each([['string', 'boom'], ['null', null], ['undefined', undefined]])(
    'falls back to the retry prompt for %s',
    (_label: string, value: unknown) => {
      expect(mapSubmitError(value)).toBe('Could not save the report. Try again.');
    }
  );
});
