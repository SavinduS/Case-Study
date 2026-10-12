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
 */
export function usePortalSession() {
  const [session, setSession] = useState(() => readSession());
  const [waiting, setWaiting] = useState(() => readSession() === null && isEmbedded());

  useEffect(() => {
    if (session || !isEmbedded() || !waiting) return undefined;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const current = readSession();
      if (current) {
        setSession(current);
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