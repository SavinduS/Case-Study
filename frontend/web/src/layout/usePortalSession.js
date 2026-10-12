import { useEffect, useState } from 'react';
import { isEmbedded, readSession, requestSessionFromHost } from '../services/session.js';

// How long to wait for the mobile app to hand over its session before falling
// back to the sign-in page. The app injects it before the page's own scripts,
// so this only has to cover a slow or restored page load.
const HANDOFF_WAIT_MS = 400;
const HANDOFF_ATTEMPTS = 4;

/**
 * The signed-in user for the dashboard.
 *
 * Two ways to get here:
 *  - opened in a browser: nothing is stored, so the caller sends the user to
 *    the sign-in page;
 *  - opened in the mobile app's WebView: the app writes the session into
 *    localStorage before the page loads. If it has not landed yet, ask the app
 *    for it and wait briefly rather than flashing the sign-in page.
 *
 * The session is read during render rather than kept in state: a sign-in
 * stores it and then navigates, and the guard checks the session in that very
 * next render. State set from an effect would arrive a render too late, and
 * the guard would bounce straight back to /login.
 */
export function usePortalSession() {
  const session = readSession();
  const [waiting, setWaiting] = useState(() => session === null && isEmbedded());

  useEffect(() => {
    if (session || !isEmbedded() || !waiting) return undefined;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (readSession()) {
        // Stop waiting; the next render picks the session up.
        setWaiting(false);
      } else if (attempts >= HANDOFF_ATTEMPTS) {
        // The app has nothing for us either.
        setWaiting(false);
      } else {
        requestSessionFromHost();
      }
    }, HANDOFF_WAIT_MS);

    return () => clearInterval(timer);
  }, [session, waiting]);

  return { session, waiting };
}

export default usePortalSession;