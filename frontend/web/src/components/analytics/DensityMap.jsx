import { useEffect } from 'react';
import L from 'leaflet';

export default function DensityMap({ rows }) {
  useEffect(() => {
    const map = L.map('density-map', { scrollWheelZoom: false }).setView([6.37, 81.14], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    rows.forEach((r, i) => {
      L.circleMarker([6.37 + i * 0.06, 81.14 + i * 0.06], {
        radius: 12 + r.density * 5,
        color: r.density > 4 ? '#b4552d' : r.density > 2 ? '#a67c00' : '#2e7d4f',
        fillOpacity: 0.25
      }).addTo(map).bindPopup(`<b>${r.zone}</b><br/>${r.density}/km²`);
    });
    return () => map.remove();
  }, [rows]);
  return (
    <div>
      <div id="density-map" className="h-56 overflow-hidden rounded-xl ring-1 ring-stone-100" />
      <div className="mt-2 flex gap-3 text-xs text-stone-500">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-clay-500" />High</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-gold-500" />Medium</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-moss-500" />Low</span>
      </div>
    </div>
  );
}
