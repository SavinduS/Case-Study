/**
 * AlertMiniMap — static vector inset for the alert modal.
 *
 * Deliberately not a second Leaflet instance: it only needs to show the
 * breached zone, the park edge and the animal's fix, so it is cheaper to
 * render with a small equirectangular projection over plain SVG.
 */
export default function AlertMiniMap({ zone, position, width = 260, height = 190 }) {
  if (!zone) return null;

  const [minLng, minLat] = zone.polygon[0];
  const lngs = zone.polygon.map(([lng]) => lng);
  const lats = zone.polygon.map(([, lat]) => lat);
  const spanLng = Math.max(...lngs) - minLng || 1;
  const spanLat = Math.max(...lats) - minLat || 1;
  const pad = 0.25;

  const project = ([lng, lat]) => {
    const x = ((lng - minLng) / (spanLng * (1 + pad * 2)) + pad / (1 + pad * 2)) * width;
    const y = (1 - (lat - minLat) / (spanLat * (1 + pad * 2)) - pad / (1 + pad * 2)) * height;
    return [x, y];
  };

  const zonePath = zone.polygon.map(project).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z';
  const [px, py] = project(position);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="block rounded-md bg-park-900"
      role="img"
      aria-label={`Breach location within ${zone.name}`}
    >
      <defs>
        <pattern id="mini-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="#2a1b16" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#d7263d" strokeWidth="2" strokeOpacity="0.55" />
        </pattern>
      </defs>

      <rect width={width} height={height} fill="#1c2a22" />
      <path d={zonePath} fill="url(#mini-hatch)" stroke="#d7263d" strokeWidth="1.5" />

      <circle className="breach-pulse" cx={px} cy={py} r={6} fill="#d7263d" fillOpacity="0.35" />
      <circle cx={px} cy={py} r={7} fill="#d7263d" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}