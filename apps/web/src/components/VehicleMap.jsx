import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [-3.7319, -38.5267]; // Fortaleza

export default function VehicleMap({ latitude, longitude, label }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    if (!hasCoords) {
      mapRef.current.setView(DEFAULT_CENTER, 13);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const position = [lat, lng];

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'vehicle-marker-icon',
        html: '<span class="vehicle-marker-pin">📍</span>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      markerRef.current = L.marker(position, { icon }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng(position);
    }

    if (label) markerRef.current.bindPopup(label).openPopup();
    mapRef.current.setView(position, 15);
  }, [latitude, longitude, label]);

  return <div ref={containerRef} className="vehicle-map" />;
}
