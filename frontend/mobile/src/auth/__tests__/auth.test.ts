import { describe, expect, it } from 'vitest';
import {
  USER_ROLES,
  WEB_UI_ROLES,
  dashboardPathForRole,
  destinationForRole,
  goesToWebDashboard,
  isUserRole,
  roleDescription,
  roleLabel
} from '../roles';
import { isAuthSession } from '../sessionShape';

describe('sign-in routing by role', () => {
  it('sends Park Manager and Operations Officer to the web UI', () => {
    expect(goesToWebDashboard('manager')).toBe(true);
    expect(goesToWebDashboard('officer')).toBe(true);
    expect(WEB_UI_ROLES).toEqual(['manager', 'officer']);
  });

  it('keeps Villager and Ranger in the field app', () => {
    expect(destinationForRole('villager')).toBe('fieldApp');
    expect(destinationForRole('ranger')).toBe('fieldApp');
    expect(goesToWebDashboard('villager')).toBe(false);
    expect(goesToWebDashboard('ranger')).toBe(false);
  });

  it('gives every role a destination and a label', () => {
    for (const role of USER_ROLES) {
      expect(['webDashboard', 'fieldApp']).toContain(destinationForRole(role));
      expect(roleLabel(role).length).toBeGreaterThan(0);
      expect(roleDescription(role)).toMatch(/Opens /);
    }
  });
});

describe('dashboard home path by role', () => {
  it('sends the Park Manager to the analytics workspace', () => {
    expect(dashboardPathForRole('manager')).toBe('/analytics/type');
  });

  it('sends the Operations Officer to the collar alert dashboard', () => {
    expect(dashboardPathForRole('officer')).toBe('/');
  });

  it('has a path for every role, even the ones that never see the web UI', () => {
    for (const role of USER_ROLES) {
      expect(dashboardPathForRole(role).startsWith('/')).toBe(true);
    }
  });
});

describe('isUserRole', () => {
  it('accepts the four roles the backend signs', () => {
    for (const role of USER_ROLES) {
      expect(isUserRole(role)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    for (const value of ['admin', 'Manager', '', null, undefined, 3, {}]) {
      expect(isUserRole(value)).toBe(false);
    }
  });
});

describe('isAuthSession', () => {
  const session = {
    id: 'u1',
    name: 'Nimali Perera',
    role: 'ranger',
    token: 'jwt.token.value'
  };

  it('accepts a complete session', () => {
    expect(isAuthSession(session)).toBe(true);
  });

  it('rejects a session the app cannot route on', () => {
    expect(isAuthSession({ ...session, role: 'admin' })).toBe(false);
    expect(isAuthSession({ ...session, token: '' })).toBe(false);
    expect(isAuthSession({ ...session, id: '' })).toBe(false);
  });

  it('rejects partial or non-object values from storage', () => {
    expect(isAuthSession(null)).toBe(false);
    expect(isAuthSession('token')).toBe(false);
    expect(isAuthSession({ id: 'u1', role: 'villager' })).toBe(false);
  });
});