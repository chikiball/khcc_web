"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Coral teardrop pin in the KHCC brand colour. Avoids Leaflet's default
// marker-icon assets which reference relative URLs that Next.js bundling
// does not resolve cleanly.
const PIN = L.divIcon({
  className: "",
  html: `
    <div style="
      width:24px; height:24px;
      background:#ec6e8a;
      border:3px solid #fdfaf5;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 4px rgba(0,0,0,0.35);
    "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

// Default centre when no pin is set yet — Singapore (the club's primary
// region; revisit if KHCC expands geographically).
const DEFAULT_CENTER: [number, number] = [1.2806, 103.8714];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/**
 * When a route polyline is shown, frame the map to the whole track instead
 * of the pin. Runs on mount + whenever the coords change (e.g., admin
 * re-uploads a different GPX without refreshing). The 24px padding keeps
 * the line clear of the edges.
 */
function FitToRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.fitBounds(L.latLngBounds(coords), { padding: [24, 24] });
  }, [map, coords]);
  return null;
}

export function MapPicker({
  lat,
  lng,
  readOnly,
  onChange,
  height = 280,
  routeCoords,
}: {
  lat: number | null;
  lng: number | null;
  readOnly?: boolean;
  onChange?: (lat: number, lng: number) => void;
  height?: number;
  routeCoords?: [number, number][];
}) {
  const hasPin = lat != null && lng != null;
  const hasRoute = !!routeCoords && routeCoords.length >= 2;
  const center: [number, number] = hasPin ? [lat, lng] : DEFAULT_CENTER;
  const zoom = hasPin ? 14 : 11;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: "100%", borderRadius: 16, zIndex: 0 }}
      scrollWheelZoom={false}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {hasRoute && (
        <Polyline
          positions={routeCoords}
          pathOptions={{ color: "#ec6e8a", weight: 4, opacity: 0.85 }}
        />
      )}
      {hasPin && <Marker position={[lat, lng]} icon={PIN} />}
      {hasRoute && <FitToRoute coords={routeCoords} />}
      {!readOnly && onChange && <ClickHandler onPick={onChange} />}
    </MapContainer>
  );
}
