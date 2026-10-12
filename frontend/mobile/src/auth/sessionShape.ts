/** Guards a value that came from AsyncStorage into the shape the app needs. */
import { isUserRole } from './roles';
import type { AuthSession } from './types';

export function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.name === 'string' &&
    isUserRole(candidate.role) &&
    typeof candidate.token === 'string' &&
    candidate.token.length > 0
  );
}