import { useEffect } from 'react';
import L from 'leaflet';

export default function DensityMap({ rows }) {
  useEffect(() => {
    const map = L.map('density-map').setView([6.37, 81.14], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    rows.forEach((r, i) => {
      const size = 10 + r.density * 6;
      L.circleMarker([6.37 + i * 0.05, 81.14 + i * 0.05], { radius: size }).addTo(map).bindPopup(`${r.zone}: ${r.density}/km²`);
    });
    return () => map.remove();
  }, [rows]);
  return <div id="density-map" className="mapbox" />;
}
