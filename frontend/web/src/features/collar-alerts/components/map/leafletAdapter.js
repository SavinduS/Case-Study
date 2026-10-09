import L from 'leaflet';

/**
 * Coordinate-system adapter.
 *
 * All park data in this feature is stored as GeoJSON-style [lng, lat] pairs
 * because that is what the geofence maths and any REST payload use. Leaflet
 * however interprets a LatLngExpression as [lat, lng]. Every call that hands
 * data to Leaflet goes through here so the swap happens in exactly one place.
 */
export const toLatLng = ([lng, lat]) => [lat, lng];

export const toLatLngRing = (ring) => ring.map(toLatLng);

/** LatLngBounds covering every ring in a list of [lng, lat] polygons. */
export function boundsForRings(rings, pad = 0.02) {
  const points = rings.flat();
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);

  return L.latLngBounds([
    [Math.min(...lats) - pad, Math.min(...lngs) - pad],
    [Math.max(...lats) + pad, Math.max(...lngs) + pad]
  ]);
}