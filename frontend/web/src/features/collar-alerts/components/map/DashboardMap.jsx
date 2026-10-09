import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import { PARK_BOUNDARY } from '../../data/parkData.js';
import { boundsForRings, toLatLng, toLatLngRing } from './leafletAdapter.js';
import { THREAT_LEVEL } from '../../domain/constants.js';
import { collarIcon, breachIcon, rangerIcon, settlementIcon } from './mapIcons.js';
import MapLegend from './MapLegend.jsx';
import { ClockChip, StatusChips, ControlStack, useClock } from './MapChrome.jsx';

/**
 * Satellite first, OpenStreetMap as the offline fallback. Esri World
 * Imagery is used because it needs no API key, so the dashboard still
 * renders on a machine with no Esri account configured.
 */
const IMAGERY = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery &copy; Esri',
  maxZoom: 18
};
const STREET = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
};

const TRAIL_LENGTH = 8;

/** Injects the diagonal hatch pattern used to shade high-risk zones. */
function ensureHatchPattern(map) {
  const svg = map.getPanes().overlayPane.querySelector('svg');
  if (!svg) return;

  const ns = 'http://www.w3.org/2000/svg';
  const existing = svg.querySelector('defs#wildlife-geofence-defs');
  if (existing) return;

  const defs = document.createElementNS(ns, 'defs');
  defs.setAttribute('id', 'wildlife-geofence-defs');

  const pattern = document.createElementNS(ns, 'pattern');
  pattern.setAttribute('id', 'geofence-hatch');
  pattern.setAttribute('width', '9');
  pattern.setAttribute('height', '9');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('patternTransform', 'rotate(45)');

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', '9');
  bg.setAttribute('height', '9');
  bg.setAttribute('fill', 'rgba(215,38,61,0.12)');

  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('y1', '0');
  line.setAttribute('x2', '0');
  line.setAttribute('y2', '9');
  line.setAttribute('stroke', 'rgba(215,38,61,0.7)');
  line.setAttribute('stroke-width', '2.5');

  pattern.appendChild(bg);
  pattern.appendChild(line);
  defs.appendChild(pattern);
  svg.insertBefore(defs, svg.firstChild);
}

/**
 * DashboardMap — the park map that carries the use case: park boundary,
 * pre-configured high-risk geofences, live collar fixes, breach points and
 * ranger deployments. Imperative handle drives the map control stack.
 */
const DashboardMap = forwardRef(function DashboardMap(
  { collars, zones, rangerTeams, settlements, openAlerts, onSelectCollar, onToggleBoundary, boundaryVisible = true },
  ref
) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const collarMarkersRef = useRef(new Map());
  const breachMarkersRef = useRef(new Map());
  const trailsRef = useRef(new Map());
  const [ready, setReady] = useState(false);

  const clock = useClock();

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: [8.2, 81.08],
      zoom: 12,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer(IMAGERY.url, { attribution: IMAGERY.attribution, maxZoom: IMAGERY.maxZoom }).addTo(map);
    L.tileLayer(STREET.url, { attribution: STREET.attribution, maxZoom: STREET.maxZoom }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    const onViewChange = () => ensureHatchPattern(map);
    map.on('zoomend moveend', onViewChange);

    setReady(true);

    return () => {
      map.off('zoomend moveend', onViewChange);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fitPark: () => {
        const map = mapRef.current;
        if (!map) return;
        map.invalidateSize();
        map.fitBounds(boundsForRings([PARK_BOUNDARY]), { padding: [40, 40] });
      },
      centreOnBreach: () => {
        const map = mapRef.current;
        const first = openAlertsRef.current[0];
        if (!map || !first) return false;
        map.flyTo(toLatLng(first.position), 15, { duration: 0.8 });
        return true;
      },
      locateCollar: (position) => mapRef.current?.flyTo(toLatLng(position), 14, { duration: 0.8 })
    }),
    []
  );

  // Kept in a ref so the imperative handle never goes stale.
  const openAlertsRef = useRef(openAlerts);
  openAlertsRef.current = openAlerts;

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // The map is created before layout settles, so force a size refresh
    // before fitting or the first fitBounds uses a zero-height container.
    map.invalidateSize();
    map.fitBounds(boundsForRings([PARK_BOUNDARY]), { padding: [40, 40] });
  }, [ready]);

  // Park boundary: red outline, no fill (matches the wireframe).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return undefined;
    const layer = L.polygon(toLatLngRing(PARK_BOUNDARY), {
      color: '#d7263d',
      weight: 2.5,
      fill: false
    }).addTo(map);
    layer.bindTooltip('Minneriya National Park boundary', { sticky: true });
    return () => map.removeLayer(layer);
  }, [ready]);

  // High-risk geofences: hatched fill plus a dashed outline.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return undefined;

    ensureHatchPattern(map);
    const layers = zones.map((zone) =>
      L.polygon(toLatLngRing(zone.polygon), {
        color: zone.threatLevel === THREAT_LEVEL.CRITICAL ? '#d7263d' : '#e9a23b',
        weight: 2,
        dashArray: '6 4',
        fill: true,
        fillColor: zone.threatLevel === THREAT_LEVEL.CRITICAL ? '#d7263d' : '#e9a23b',
        fillOpacity: boundaryVisible ? 1 : 0,
        className: boundaryVisible ? 'geofence-zone' : ''
      })
        .addTo(map)
        .bindTooltip(`${zone.name} (${zone.gridRef})`, { sticky: true })
    );

    return () => layers.forEach((layer) => map.removeLayer(layer));
  }, [ready, zones, boundaryVisible]);

  // Settlements justify the threat escalation shown in the alert modal.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return undefined;
    const layers = settlements.map((settlement) =>
      L.marker(toLatLng(settlement.position), { icon: settlementIcon(), interactive: true })
        .addTo(map)
        .bindTooltip(settlement.name, { sticky: true })
    );
    return () => layers.forEach((layer) => map.removeLayer(layer));
  }, [ready, settlements]);

  // Ranger deployments.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return undefined;
    const layers = rangerTeams.map((team) =>
      L.marker(toLatLng(team.position), { icon: rangerIcon(), interactive: true })
        .addTo(map)
        .bindTooltip(`${team.name} (${team.status})`, { sticky: true })
    );
    return () => layers.forEach((layer) => map.removeLayer(layer));
  }, [ready, rangerTeams]);

  // Live collar fixes plus their movement trails.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    for (const collar of collars) {
      const trail = trailsRef.current.get(collar.collarId) ?? [];
      trail.push(collar.position);
      if (trail.length > TRAIL_LENGTH) trail.shift();
      trailsRef.current.set(collar.collarId, trail);

      if (trail.length > 1) {
        L.polyline(trail.map(toLatLng), {
          color: collar.status === 'signal_lost' ? '#9ca3af' : '#2e7d4f',
          weight: 1.5,
          dashArray: '3 4',
          opacity: 0.8
        }).addTo(map);
      }

      const marker = collarMarkersRef.current.get(collar.collarId);
      if (marker) {
        marker.setLatLng(toLatLng(collar.position));
        marker.setIcon(collarIcon({ status: collar.status }));
      } else {
        const created = L.marker(toLatLng(collar.position), {
          icon: collarIcon({ status: collar.status }),
          keyboard: true,
          title: `${collar.species} ${collar.collarId}`
        })
          .addTo(map)
          .bindTooltip(`${collar.species} ${collar.collarId} - ${collar.status.replace('_', ' ')}`, {
            sticky: true
          });
        created.on('click', () => onSelectCollar?.(collar.collarId));
        collarMarkersRef.current.set(collar.collarId, created);
      }
    }
  }, [ready, collars, onSelectCollar]);

  // Breach points for every open alert.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const seen = new Set();
    for (const alert of openAlerts) {
      seen.add(alert.alertId);
      const existing = breachMarkersRef.current.get(alert.alertId);
      if (existing) {
        existing.setLatLng(toLatLng(alert.position));
        continue;
      }
      const marker = L.marker(toLatLng(alert.position), {
        icon: breachIcon({ critical: alert.threatLevel === THREAT_LEVEL.CRITICAL }),
        zIndexOffset: 500
      })
        .addTo(map)
        .bindTooltip(`Breach ${alert.alertId}`, { sticky: true });
      marker.on('click', () => onSelectCollar?.(alert.collarId));
      breachMarkersRef.current.set(alert.alertId, marker);
    }

    for (const [alertId, marker] of breachMarkersRef.current) {
      if (!seen.has(alertId)) {
        map.removeLayer(marker);
        breachMarkersRef.current.delete(alertId);
      }
    }
  }, [ready, openAlerts, onSelectCollar]);

  const onControl = useCallback((key) => {
    if (key === 'fit') ref.current?.fitPark?.();
    if (key === 'locate') ref.current?.centreOnBreach?.();
  }, [ref]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" role="application" aria-label="Park operations map" />
      <ClockChip time={clock} />
      <StatusChips
        signalLost={collars.some((collar) => collar.status === 'signal_lost')}
        boundaryVisible={boundaryVisible}
        onToggleBoundary={onToggleBoundary}
      />
      <ControlStack onAction={onControl} />
      {boundaryVisible && <MapLegend zones={zones} />}
    </div>
  );
});

export default DashboardMap;