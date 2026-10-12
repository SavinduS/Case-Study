import { beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Every suite starts with an empty session: the API client reads it to decide
// whether to send an Authorization header, and a leftover token from another
// suite would make that assertion meaningless.
beforeEach(() => {
  window.localStorage.clear();
});

// jsdom does not implement matchMedia, which the map chrome and portals use.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  });
}
