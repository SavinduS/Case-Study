import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthSession } from './sessionShape';
import type { AuthSession } from './types';

const STORAGE_KEY = '@wildlife-alert/session';

/**
 * The signed-in user is kept on the device so the app opens straight into the
 * right UI instead of asking for the phone number on every launch. The token
 * expires on its own; App.tsx revalidates it against GET /api/auth/me on start
 * and drops the session when the server rejects it.
 */

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Storage can hold anything (older builds, hand-edited values). Anything
    // that is not a complete session is discarded rather than half-trusted.
    if (!isAuthSession(parsed)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}