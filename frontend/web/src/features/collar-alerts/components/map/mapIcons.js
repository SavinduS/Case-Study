import L from 'leaflet';

/**
 * Inline SVG markers for the operations map. Built with divIcon so they
 * inherit the Tailwind-free SVG styling used by the high-fidelity
 * wireframe and need no sprite assets.
 */

const SIZE = 34;

function wrap(inner, { className = '', size = SIZE } = {}) {
  return L.divIcon({
    className: `collar-marker ${className}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">${inner}</svg>`
  });
}

function elephantBody(fill) {
  return `
    <ellipse cx="15" cy="15" rx="8.5" ry="6.5" fill="${fill}"/>
    <circle cx="24" cy="16" r="5" fill="${fill}"/>
    <path d="M27.5 19.5c1.8 2 2.2 4.6 1 6.6-.6 1-2 .8-2-.4 0-1.8-.5-3.2-1.6-4.4z" fill="${fill}"/>
    <path d="M20.5 12.5c1.9-.6 3.6.6 3.8 2.4.2 1.7-1.3 3-3 2.7-1.6-.3-2.4-1.6-2-3 .3-1 1-1.7 2.2-2.1z" fill="#ffffff" opacity="0.45"/>
    <path d="M8.5 19.5h3v6h-3zM13 19.5h3v6h-3z" fill="${fill}"/>
  `;
}

/** Signal arcs drawn beside a collar to suggest live transmission. */
function signalArcs(color) {
  return `
    <g stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M12.5 4.5a9 9 0 0 1 5 4.6" opacity="0.9"/>
      <path d="M10.5 7.6a5.8 5.8 0 0 1 3.2 3" opacity="0.6"/>
    </g>
  `;
}

/** Tracked collar: dark chip with an elephant glyph and live signal arcs. */
export function collarIcon({ status = 'active', selected = false } = {}) {
  if (status === 'signal_lost') {
    return wrap(
      `${elephantBody('#9ca3af')}<g stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"><path d="M9 5 15 11M15 5 9 11"/></g>`,
      { className: 'opacity-70' }
    );
  }

  if (status === 'delayed') {
    return wrap(
      `<circle cx="16" cy="16" r="13" fill="#a67c00" opacity="0.25"/>
       <circle cx="16" cy="16" r="13" stroke="#a67c00" stroke-width="1.5" stroke-dasharray="3 2"/>
       ${elephantBody('#0c2b21')}${signalArcs('#a67c00')}`
    );
  }

  return wrap(
    `<circle cx="16" cy="16" r="13" fill="#ffffff" opacity="0.92"/>
     <circle cx="16" cy="16" r="13" stroke="${selected ? '#d7263d' : '#123a2d'}" stroke-width="${selected ? 2.5 : 1.5}"/>
     ${elephantBody('#0c2b21')}${signalArcs('#2e7d4f')}`
  );
}

/** Breach point: pulsing red radar disc drawn over the map. */
export function breachIcon({ critical = true } = {}) {
  const color = critical ? '#d7263d' : '#e9a23b';
  return wrap(
    `<circle class="breach-pulse" cx="16" cy="16" r="6" fill="${color}" fill-opacity="0.35"/>
     <circle cx="16" cy="16" r="7" fill="${color}" fill-opacity="0.9" stroke="#ffffff" stroke-width="2"/>
     <circle cx="16" cy="16" r="2" fill="#ffffff"/>`,
    { size: 44 }
  );
}

/** Ranger team currently deployed. */
export function rangerIcon() {
  return wrap(
    `<rect x="3" y="9" width="20" height="12" rx="2.5" fill="#1d4a38" stroke="#ffffff" stroke-width="1.6"/>
     <path d="M23 13h5l3 4v4h-8z" fill="#2e7d4f" stroke="#ffffff" stroke-width="1.4"/>
     <circle cx="10" cy="23" r="3" fill="#0c2b21" stroke="#ffffff" stroke-width="1.4"/>
     <circle cx="24" cy="23" r="3" fill="#0c2b21" stroke="#ffffff" stroke-width="1.4"/>`,
    { size: 30 }
  );
}

/** Small settlement dot used to justify threat escalation. */
export function settlementIcon() {
  return wrap(
    `<rect x="7" y="12" width="9" height="9" rx="1.5" fill="#b4552d"/>
     <path d="M5.5 12 11.5 6.5 17.5 12z" fill="#8a3f1f"/>
     <rect x="23" y="14" width="7" height="7" rx="1.5" fill="#b4552d"/>
     <path d="M21.5 14 26.5 9.5 31.5 14z" fill="#8a3f1f"/>`,
    { size: 26 }
  );
}