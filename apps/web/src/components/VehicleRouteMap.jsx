import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [-3.7319, -38.5267];

export default function VehicleRouteMap({ points = [], label }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(DEFAULT_CENTER, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapRef.current);

    layerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;

    layerRef.current.clearLayers();

    const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (valid.length === 0) {
      mapRef.current.setView(DEFAULT_CENTER, 13);
      return;
    }

    const latlngs = valid.map((p) => [p.latitude, p.longitude]);
    const polyline = L.polyline(latlngs, { color: '#f5a623', weight: 4, opacity: 0.85 });
    layerRef.current.addLayer(polyline);

    const start = valid[0];
    const end = valid[valid.length - 1];

    L.circleMarker([start.latitude, start.longitude], {
      radius: 7,
      color: '#22c55e',
      fillColor: '#22c55e',
      fillOpacity: 1,
    }).bindPopup('Início').addTo(layerRef.current);

    L.circleMarker([end.latitude, end.longitude], {
      radius: 7,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 1,
    }).bindPopup(label || 'Fim').addTo(layerRef.current);

    mapRef.current.fitBounds(polyline.getBounds(), { padding: [24, 24] });
  }, [points, label]);

  return <div ref={containerRef} className="vehicle-map" />;
}
