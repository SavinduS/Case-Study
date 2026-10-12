import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Topbar from '../src/layout/Topbar.jsx';
import App from '../src/App.jsx';
import LoginPage from '../src/pages/LoginPage.jsx';
import AnalyticsShell from '../src/features/reports/components/AnalyticsShell.jsx';
import {
  SESSION_KEY,
  readSession,
  saveSession,
  signOut,
  requestSessionFromHost,
  isEmbedded,
  homePathForRole,
  initialsOf,
  roleLabel
} from '../src/services/session.js';

const OFFICER = {
  id: 'u1',
  name: 'Nimali Perera',
  role: 'officer',
  token: 'jwt.token.value'
};

function storeSession(session) {
  saveSession(session);
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

// The dashboard page polls the API; the guard tests are not about that.
vi.mock('../src/features/collar-alerts/pages/DashboardPage.jsx', () => ({
  default: () => <div>Officer dashboard</div>
}));

// So is the analytics workspace behind the manager shell.
vi.mock('../src/features/reports/pages/ReportsPage.jsx', () => ({
  default: () => <div>Analytics reports</div>
}));
vi.mock('../src/features/reports/pages/ComparisonPage.jsx', () => ({
  default: () => <div>Comparison</div>
}));
vi.mock('../src/features/reports/pages/SavedReportsPage.jsx', () => ({
  default: () => <div>Saved reports</div>
}));

describe('dashboard session', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ReactNativeWebView;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the session the app handed over', () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(OFFICER));
    expect(readSession()).toEqual(OFFICER);
  });

  it('treats missing or unusable storage as signed out', () => {
    expect(readSession()).toBeNull();

    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ ...OFFICER, role: 'admin' }));
    expect(readSession()).toBeNull();

    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: 'u1', role: 'officer' }));
    expect(readSession()).toBeNull();

    window.localStorage.setItem(SESSION_KEY, 'not json');
    expect(readSession()).toBeNull();
  });

  it('clears the session and tells the app when inside the WebView', () => {
    storeSession(OFFICER);
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };

    signOut();

    expect(readSession()).toBeNull();
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'signedOut' }));
  });

  it('signs out without a host bridge when opened in a browser', () => {
    storeSession(OFFICER);

    expect(() => signOut()).not.toThrow();
    expect(readSession()).toBeNull();
  });

  it('detects the app WebView and can ask it for the session', () => {
    expect(isEmbedded()).toBe(false);

    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };

    expect(isEmbedded()).toBe(true);
    requestSessionFromHost();
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'requestSession' }));
  });

  it('labels roles and derives avatar initials', () => {
    expect(roleLabel(OFFICER)).toBe('Operations Officer');
    expect(roleLabel({ ...OFFICER, role: 'manager' })).toBe('Park Manager');
    expect(roleLabel(null)).toBe('Operations Officer');
    expect(initialsOf('Nimali Perera')).toBe('NP');
    expect(initialsOf('Ranger')).toBe('RA');
  });

  it('takes initials from words, not punctuation', () => {
    // "Operations Officer (Demo)" used to render the avatar "O(".
    expect(initialsOf('Operations Officer (Demo)')).toBe('OO');
    expect(initialsOf('Bandula R. Perera')).toBe('BP');
    expect(initialsOf('  ')).toBe('');
    expect(initialsOf(null)).toBe('');
    expect(initialsOf('!!!')).toBe('');
  });

  it('gives each web role its own home in the portal', () => {
    expect(homePathForRole('manager')).toBe('/analytics/type');
    expect(homePathForRole('officer')).toBe('/');
    expect(homePathForRole('villager')).toBe('/');
  });
});

describe('portal sign-in', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ReactNativeWebView;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signs in with an email or phone number and keeps the session', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(OFFICER));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email or phone number'), 'officer@wildlife.demo');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(readSession()).toEqual(OFFICER));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      identifier: 'officer@wildlife.demo',
      password: 'password123'
    });
  });

  it('shows the server message and stores nothing when the sign-in fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Invalid credentials' }, 401))
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email or phone number'), 'officer@wildlife.demo');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(readSession()).toBeNull();
  });

  it('sends villager and ranger accounts to the mobile app', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...OFFICER, role: 'ranger', name: 'Ranger (Demo)' }))
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email or phone number'), 'ranger@wildlife.demo');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('mobile app');
    expect(readSession()).toBeNull();
  });

  it('asks for both fields before calling the API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the password on request and hides it again', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
  });
});

describe('portal route guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ReactNativeWebView;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a browser visitor to the sign-in page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('signs a manager into the analytics workspace', async () => {
    const user = userEvent.setup();
    const manager = { ...OFFICER, role: 'manager', name: 'Bandula Perera' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(manager)));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email or phone number'), 'manager@wildlife.demo');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Analytics reports')).toBeInTheDocument();
    expect(readSession()).toEqual(manager);
  });

  it('lets a signed-in officer into the dashboard', () => {
    storeSession(OFFICER);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Officer dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('opens the analytics workspace for the Park Manager, not the officer dashboard', () => {
    storeSession({ ...OFFICER, role: 'manager', name: 'Bandula Perera' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // "/" is not the manager's home: the catch-all sends them to analytics.
    expect(screen.getByText('Analytics reports')).toBeInTheDocument();
    expect(screen.queryByText('Officer dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Park Manager')).toBeInTheDocument();
  });

  it('sends a manager to their own home from an unknown URL', () => {
    storeSession({ ...OFFICER, role: 'manager' });

    render(
      <MemoryRouter initialEntries={['/does-not-exist']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Analytics reports')).toBeInTheDocument();
  });

  it('turns away a villager session even if one is stored', () => {
    storeSession({ ...OFFICER, role: 'villager' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('turns away a ranger session even if one is stored', () => {
    storeSession({ ...OFFICER, role: 'ranger' });

    render(
      <MemoryRouter initialEntries={['/analytics/type']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('gives the Operations Officer the analytical reports the Park Manager uses', () => {
    storeSession(OFFICER);

    render(
      <MemoryRouter initialEntries={['/analytics/type']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Analytics reports')).toBeInTheDocument();
    expect(screen.getByText('Operations Officer')).toBeInTheDocument();
    // And a visible route back out of the Park Manager's workspace.
    expect(screen.getByRole('link', { name: /Back to dashboard/ })).toHaveAttribute('href', '/');
  });

  it('sends an officer typing /reports to the working analytics workspace', () => {
    storeSession(OFFICER);

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Analytics reports')).toBeInTheDocument();
  });

  it('has no /admin route for the Operations Officer', () => {
    storeSession(OFFICER);

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    // Unknown URLs return each role to its own home, never to a dead admin page.
    expect(screen.getByText('Officer dashboard')).toBeInTheDocument();
  });

  it('waits for the app to hand over the session instead of flashing sign-in', async () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Nothing on screen while the handoff is in flight...
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    // ...and the app was asked for the session.
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'requestSession' }))
    );

    // Once the app says it has none, the sign-in page takes over.
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }, { timeout: 4000 })
    ).toBeInTheDocument();
  });
});

describe('Topbar sign out', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ReactNativeWebView;
  });

  it('shows the signed-in user and signs them out of the dashboard', async () => {
    const user = userEvent.setup();
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };
    storeSession(OFFICER);

    render(<MemoryRouter><Topbar /></MemoryRouter>);

    // The role is the only label: the display name beside it repeated it.
    expect(screen.getByText('Operations Officer')).toBeInTheDocument();
    expect(screen.queryByText('Nimali Perera')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(readSession()).toBeNull();
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'signedOut' }));
  });

  it('clears the browser session when there is no app to tell', async () => {
    const user = userEvent.setup();
    storeSession(OFFICER);

    render(<MemoryRouter><Topbar /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(readSession()).toBeNull();
  });

  it('gives the analytics workspace its own sign out', async () => {
    const user = userEvent.setup();
    storeSession({ ...OFFICER, role: 'manager', name: 'Bandula Perera' });

    render(
      <MemoryRouter>
        <AnalyticsShell><div>Analytics reports</div></AnalyticsShell>
      </MemoryRouter>
    );

    expect(screen.getByText('Park Manager')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(readSession()).toBeNull();
  });

  // The officer reaches this workspace from the top bar, so it has to carry a
  // route back out — otherwise they are stuck in the Park Manager's view.
  it('offers the Operations Officer a way back to the alert dashboard', () => {
    storeSession(OFFICER);

    render(
      <MemoryRouter initialEntries={['/analytics/type']}>
        <AnalyticsShell><div>Analytics reports</div></AnalyticsShell>
      </MemoryRouter>
    );

    const back = screen.getByRole('link', { name: /Back to dashboard/ });
    expect(back).toHaveAttribute('href', '/');
  });

  it('offers the Park Manager no dashboard link: this is their home', () => {
    storeSession({ ...OFFICER, role: 'manager' });

    render(
      <MemoryRouter initialEntries={['/analytics/type']}>
        <AnalyticsShell><div>Analytics reports</div></AnalyticsShell>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /Back to dashboard/ })).not.toBeInTheDocument();
  });

  it('shows the role once in the analytics workspace', () => {
    storeSession(OFFICER);

    render(
      <MemoryRouter>
        <AnalyticsShell><div>Analytics reports</div></AnalyticsShell>
      </MemoryRouter>
    );

    expect(screen.getAllByText('Operations Officer')).toHaveLength(1);
    expect(screen.queryByText('Nimali Perera')).not.toBeInTheDocument();
  });
});