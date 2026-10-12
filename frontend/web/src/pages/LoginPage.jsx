import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import { ApiError, login } from '../services/api.js';
import { DASHBOARD_ROLES, ROLE_LABELS, homePathForRole, saveSession } from '../services/session.js';

const INPUT =
  'w-full rounded-full border bg-sand-100/70 py-3 pl-11 pr-4 text-sm text-park-900 ' +
  'placeholder:text-park-700/40 outline-none transition-colors focus:bg-white focus:ring-2 ' +
  'focus:ring-moss-500/40';

const INPUT_OK = 'border-sand-200 focus:border-moss-500';
const INPUT_BAD = 'border-alert-600 focus:border-alert-600 focus:ring-alert-600/30';

/**
 * Portal sign-in. Opened directly in a browser this is how a session starts;
 * inside the mobile app's WebView the app has already signed the user in and
 * the guard never routes here.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      // Each role works in its own part of the portal.
      navigate(homePathForRole(session.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-sand-100">
      {/* Full-bleed split: the brand panel and the form each take half the
          screen on a desktop, and stack on a phone. */}
      {/* Two stacked rows on a phone, two full-height columns from lg up. */}
      <div className="grid min-h-screen w-full grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-none">
        {/* Brand panel */}
        <section className="relative isolate flex flex-col justify-center overflow-hidden bg-park-900 px-8 py-12 text-white sm:px-12 lg:px-16">
          {/* Soft overlapping circles, echoing the reference layout */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-moss-500/20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-16 -z-10 h-80 w-80 rounded-full bg-park-700/60"
          />

          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-park-800 shadow-lg">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2c3.2 2.2 5 5 5 8a5 5 0 0 1-10 0c0-3 1.8-5.8 5-8Zm0 20v-6.5c0-.8.7-1.5 1.5-1.5S15 14.7 15 15.5V22h-3Z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-extrabold uppercase leading-tight tracking-[0.18em]">
                Wildlife
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Conservation portal
              </p>
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:mt-10 sm:text-4xl">
            Welcome back
          </h1>
          {/* The long explanation is the first thing to go when the form has
              to share a phone screen. */}
          <p className="mt-3 hidden max-w-sm text-sm leading-relaxed text-white/70 sm:block">
            Sign in with the email address or phone number you registered with. Your role
            decides where you land: the Operations Officer works the collar alert dashboard,
            the Park Manager the analytics workspace.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2 sm:mt-8">
            {DASHBOARD_ROLES.map((role) => (
              <li
                key={role}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85"
              >
                {ROLE_LABELS[role]}
              </li>
            ))}
          </ul>

          <p className="mt-6 hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:mt-10 sm:block">
            Anti-poaching monitoring system
          </p>
        </section>

        {/* Form panel */}
        <section className="flex flex-col justify-start bg-white px-6 py-12 sm:px-12 lg:justify-center lg:px-16">
          <h2 className="text-center text-2xl font-bold text-park-900">Sign in</h2>
          <p className="mt-1 text-center text-sm text-park-700/70">
            Enter your details to open the portal.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border border-alert-600/30 bg-alert-100 px-4 py-3 text-sm font-medium text-alert-600"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 2 1 18h18L10 2Zm0 5.6 4.6 8H5.4L10 7.6ZM9 10v3h2v-3H9Zm0 4.2v1.6h2v-1.6H9Z" />
              </svg>
              <span>{error}</span>
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="sr-only" htmlFor="identifier">
                Email or phone number
              </label>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-park-700/45"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Zm2 .6v.3l6 3.6 6-3.6v-.3H4Zm12 2.9-6.5 3.9a.9.9 0 0 1-.9 0L4 8.5V15h12V8.5Z" />
                </svg>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Email or phone number"
                  className={`${INPUT} ${error ? INPUT_BAD : INPUT_OK}`}
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-park-700/45"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10 2a4.5 4.5 0 0 0-4.5 4.5V8H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-.5V6.5A4.5 4.5 0 0 0 10 2Zm2.5 6h-5V6.5a2.5 2.5 0 0 1 5 0V8Z" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className={`${INPUT} ${error ? INPUT_BAD : INPUT_OK} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1
                    text-xs font-semibold text-park-700 transition-colors hover:bg-park-50 hover:text-park-900"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="dark"
              disabled={submitting}
              className="w-full justify-center rounded-full py-3 text-sm tracking-wide"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}