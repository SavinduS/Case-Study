/** The four roles the portal knows about, mirroring backend/models/User.js. */
export type UserRole = 'villager' | 'ranger' | 'officer' | 'manager';

/** A signed-in user as returned by POST /api/auth/login and GET /api/auth/me. */
export interface AuthSession {
  id: string;
  name: string;
  role: UserRole;
  token: string;
  /** Contact details for the profile screen; absent on older servers/sessions. */
  phone?: string;
  email?: string;
}

/**
 * Where a role is sent after signing in: the desktop dashboard in a WebView,
 * or the field UI that lives in this app.
 */
export type LoginDestination = 'webDashboard' | 'fieldApp';