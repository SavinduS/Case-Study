import Constants from 'expo-constants';

// Explicit override from frontend/mobile/.env (see .env.example). The app
// normally finds the backend on its own; this pins a specific address.
const envBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// Static fallbacks: the Android emulator reaches the host PC as 10.0.2.2,
// anything else falls back to this PC's LAN address.
const EMULATOR_BASE = 'http://10.0.2.2:5000';
const LAN_BASE = 'http://192.168.83.1:5000';

// The machine this bundle was served from. On a phone/tablet that is the Metro
// bundler address (the PC running Expo — same machine as the backend), on the
// Android emulator it is 10.0.2.2, on web it is the page hostname.
export function getHostAddress(): string | null {
  if (typeof document !== 'undefined' && document.location?.hostname) {
    return document.location.hostname;
  }
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.83.1:8081" in dev
  return hostUri ? hostUri.split(':')[0] : null;
}

// Candidate base URLs in the order they are tried:
// .env override → Metro host on :5000 → :5001 → Android emulator → LAN fallback
export function apiBaseCandidates(): string[] {
  const bases: string[] = [];
  const add = (base?: string | null) => {
    if (base && !bases.includes(base)) bases.push(base);
  };
  add(envBase);
  const host = getHostAddress();
  if (host) {
    add(`http://${host}:5000`);
    add(`http://${host}:5001`);
  }
  add(EMULATOR_BASE);
  add(LAN_BASE);
  return bases;
}
