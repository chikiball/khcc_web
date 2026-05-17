"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Leaflet expects `window` at module load — load the map only on the
// client. The static fallback is sized to match so the page does not
// jump when the map mounts.
const MapPicker = dynamic(
  () => import("./map-picker").then((m) => ({ default: m.MapPicker })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl bg-cream-100 ring-1 ring-maroon-200 flex items-center justify-center text-sm text-ink-soft"
        style={{ height: 280 }}
      >
        Loading map…
      </div>
    ),
  },
);

/**
 * Combined latitude + longitude inputs and an OpenStreetMap picker that
 * keep each other in sync. Tap the map to drop a pin (which fills the
 * inputs) or paste exact coordinates into the inputs (which moves the pin
 * on next render). Submits via the same input names as the previous pure
 * text fields so the server action is unchanged.
 */
export function LocationFields({
  initialLat,
  initialLng,
  readOnly,
}: {
  initialLat?: string | null;
  initialLng?: string | null;
  readOnly?: boolean;
}) {
  const [lat, setLat] = useState(initialLat ?? "");
  const [lng, setLng] = useState(initialLng ?? "");

  const numLat = lat.trim() ? Number(lat) : NaN;
  const numLng = lng.trim() ? Number(lng) : NaN;
  const validLat = Number.isFinite(numLat) && numLat >= -90 && numLat <= 90;
  const validLng = Number.isFinite(numLng) && numLng >= -180 && numLng <= 180;
  const pinLat = validLat && validLng ? numLat : null;
  const pinLng = validLat && validLng ? numLng : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1">Latitude</span>
          <input
            name="start_point_lat"
            type="text"
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="1.2806"
            readOnly={readOnly}
            className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow read-only:opacity-70"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1">Longitude</span>
          <input
            name="start_point_lng"
            type="text"
            inputMode="decimal"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="103.8714"
            readOnly={readOnly}
            className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow read-only:opacity-70"
          />
        </label>
      </div>
      {!readOnly && (
        <p className="text-xs text-ink-soft">
          Tap the map to drop a pin, or paste exact coordinates above.
        </p>
      )}
      <MapPicker
        lat={pinLat}
        lng={pinLng}
        readOnly={readOnly}
        onChange={(la, ln) => {
          setLat(la.toFixed(6));
          setLng(ln.toFixed(6));
        }}
      />
    </div>
  );
}
