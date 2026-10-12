/**
 * The Operations Dashboard has no login screen of its own: it is either opened
 * directly in a browser during development, or handed a session by the mobile
 * app, which writes it into the WebView's localStorage before the page loads.
 *
 * This module is the only place that knows that key, and the only place that
 * reads, clears or reports a session.
 */

export const SESSION_KEY = '@wildlife-alert/web-session';

const ROLES = ['villager', 'ranger', 'officer', 'manager'];

/** Roles that work from this dashboard; the others belong in the mobile app. */
export const DASHBOARD_ROLES = ['officer', 'manager'];

export const ROLE_LABELS = {
  villager: 'Villager',
  ranger: 'Ranger',
  officer: 'Operations Officer',
  manager: 'Park Manager'
};

// Shown when the dashboard is opened directly with no session (development).
export const DEFAULT_ROLE_LABEL = 'Operations Officer';

export function roleLabel(session) {
  if (!session) return DEFAULT_ROLE_LABEL;
  return ROLE_LABELS[session.role] ?? DEFAULT_ROLE_LABEL;
}

// Two-letter avatar initials, e.g. "Nimali Perera" -> "NP".
export function initialsOf(name) {
  if (typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * True when this page is running inside the mobile app's WebView rather than
 * in a normal browser tab.
 */
export function isEmbedded() {
  try {
    return Boolean(window.ReactNativeWebView);
  } catch {
    return false;
  }
}

/** The session handed over by the app, or null. Never throws. */
export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { id, name, role, token } = parsed;
    if (typeof id !== 'string' || !id) return null;
    if (typeof name !== 'string' || !name) return null;
    if (!ROLES.includes(role)) return null;
    if (typeof token !== 'string' || !token) return null;
    return { id, name, role, token };
  } catch {
    // Unreadable or hand-edited storage is treated as "not signed in".
    return null;
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** Keep a session from a sign-in in this browser (or WebView). */
export function saveSession(session) {
  if (typeof session !== 'object' || session === null) return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A session that cannot be stored must not be treated as one that was.
  }
}

/**
 * Tell the app that the user signed out here, so the phone returns to its
 * login screen instead of staying on a dashboard with no session.
 */
export function notifyHostSignedOut() {
  try {
    const bridge = window.ReactNativeWebView;
    if (bridge && typeof bridge.postMessage === 'function') {
      bridge.postMessage(JSON.stringify({ type: 'signedOut' }));
    }
  } catch {
    // Opened in a normal browser: nothing to notify.
  }
}

export function signOut() {
  clearSession();
  notifyHostSignedOut();
}

/**
 * Ask the app for the session when this page has none. The app normally writes
 * it before the page loads; asking covers the case where it did not (page
 * restored from cache, or the session arriving after first paint).
 */
export function requestSessionFromHost() {
  try {
    const bridge = window.ReactNativeWebView;
    if (bridge && typeof bridge.postMessage === 'function') {
      bridge.postMessage(JSON.stringify({ type: 'requestSession' }));
    }
  } catch {
    // Opened in a normal browser: there is no app to ask.
  }
}