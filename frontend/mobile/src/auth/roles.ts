import type { LoginDestination, UserRole } from './types';

/**
 * Role-based sign-in routing.
 *
 * Park Manager and Operations Officer work from the Operations Dashboard, so
 * they are handed over to the web UI (in a WebView) instead of the phone
 * screens. Villager and Ranger stay in the field app: the villager conflict
 * report flow and the ranger incident flow.
 *
 * Kept free of React so the routing can be unit-tested on its own.
 */

export const USER_ROLES: UserRole[] = ['villager', 'ranger', 'officer', 'manager'];

export const ROLE_LABELS: Record<UserRole, string> = {
  villager: 'Villager',
  ranger: 'Ranger',
  officer: 'Operations Officer',
  manager: 'Park Manager'
};

// Roles that work from the Operations Dashboard rather than from a phone.
export const WEB_UI_ROLES: UserRole[] = ['manager', 'officer'];

const DESTINATIONS: Record<UserRole, LoginDestination> = {
  manager: 'webDashboard',
  officer: 'webDashboard',
  ranger: 'fieldApp',
  villager: 'fieldApp'
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as string[]).includes(value);
}

/** Which UI a role belongs in once signed in. */
export function destinationForRole(role: UserRole): LoginDestination {
  return DESTINATIONS[role];
}

export function goesToWebDashboard(role: UserRole): boolean {
  return destinationForRole(role) === 'webDashboard';
}

/** One line explaining to the user what signing in will open for them. */
export function roleDescription(role: UserRole): string {
  return goesToWebDashboard(role)
    ? 'Opens the Operations Dashboard for alerts, dispatch and analytics.'
    : 'Opens the field app for conflict reports and incident logging.';
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}