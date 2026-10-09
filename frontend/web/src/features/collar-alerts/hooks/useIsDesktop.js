import { useEffect, useState } from 'react';

/** Tailwind's `lg` breakpoint, kept in one place so JS and CSS agree. */
export const LG_BREAKPOINT = '(min-width: 1024px)';

/**
 * True once the viewport is at least Tailwind's `lg` breakpoint (1024px).
 *
 * The layout is mobile-first in CSS, so this is only needed where behaviour
 * differs rather than just layout — for example the alert queue, which is a
 * persistent right-hand column on desktop and a toggleable bottom sheet on a
 * phone. Starts true so server-rendered markup matches the desktop design.
 */
export default function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === 'undefined' || !window.matchMedia
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const query = window.matchMedia(LG_BREAKPOINT);
    const update = () => setIsDesktop(query.matches);
    update();

    // Safari below 14 only has the deprecated listener API.
    if (query.addEventListener) {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return isDesktop;
}