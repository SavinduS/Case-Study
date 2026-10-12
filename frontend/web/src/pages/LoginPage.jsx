import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import { ApiError, login } from '../services/api.js';
import { DASHBOARD_ROLES, ROLE_LABELS, saveSession } from '../services/session.js';

/**
 * Portal sign-in. Opened directly in a browser this is how a session starts;
 * inside the mobile app's WebView the app has already signed the user in and
 * the guard never routes here.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter your email address or phone number and your password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const session = await login(identifier.trim(), password);
      if (!DASHBOARD_ROLES.includes(session.role)) {
        // A villager or ranger has no work here; the mobile app is their UI.
        setError(
          `${ROLE_LABELS[session.role]} accounts do not use this dashboard. Sign in on the mobile app instead.`
        );
        setPassword('');
        return;
      }
      saveSession(session);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not sign in. Please try again.'
      );
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-sand-200 bg-white px-3 py-2.5 text-sm text-park-900 outline-none focus:border-park-700 focus:ring-2 focus:ring-moss-500/30';

  return (
    <main className="grid min-h-screen place-items-center bg-sand-100 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-sand-200 bg-white p-6 shadow-lg"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-moss-500">
          Wildlife Conservation Portal
        </p>
        <h1 className="mt-1 text-2xl font-bold text-park-900">Sign in</h1>
        <p className="mt-1 text-sm text-park-700/70">
          Operations Officer and Park Manager accounts.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-alert-600/30 bg-alert-100 px-3 py-2 text-sm font-medium text-alert-600"
          >
            {error}
          </p>
        ) : null}

        <label className="mt-5 block text-sm font-semibold text-park-900" htmlFor="identifier">
          Email or phone number
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="officer@wildlife.demo"
          className={`mt-1 ${inputClass}`}
        />

        <label className="mt-4 block text-sm font-semibold text-park-900" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className={`mt-1 ${inputClass}`}
        />

        <div className="mt-6">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </main>
  );
}