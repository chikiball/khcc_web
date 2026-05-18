"use client";

import dynamic from "next/dynamic";

const MapPicker = dynamic(
  () => import("./map-picker").then((m) => ({ default: m.MapPicker })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl bg-cream-100 ring-1 ring-maroon-200"
        style={{ height: 220 }}
      />
    ),
  },
);

export function RideDetailMap({
  lat,
  lng,
  routeCoords,
}: {
  lat: number;
  lng: number;
  routeCoords?: [number, number][];
}) {
  return (
    <MapPicker
      lat={lat}
      lng={lng}
      readOnly
      height={220}
      routeCoords={routeCoords}
    />
  );
}
