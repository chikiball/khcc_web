/**
 * Tiny GPX parser — extracts trackpoints, computes total distance via
 * Haversine and elevation gain via summed positive deltas. No external
 * dependency: GPX is simple enough that a regex over `<trkpt>` plus
 * `<ele>` does the job for any GPX 1.0 / 1.1 file produced by Strava,
 * Komoot, RideWithGPS, Garmin Connect, etc.
 *
 * Returned distance is rounded to 1 decimal km; elevation to whole metres.
 */

type GpxPoint = { lat: number; lng: number; ele?: number };

// Matches both self-closing (<trkpt ... />) and paired (<trkpt ...>...</trkpt>)
// forms. Self-closing trkpts are produced by route planners that omit
// elevation/time data — Strava "Route GPX" with no elevation profile, e.g.
const TRKPT_RE =
  /<trkpt[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
const ELE_RE = /<ele>([^<]+)<\/ele>/;

const ELE_NOISE_THRESHOLD_M = 0.5; // ignore sub-half-metre deltas as GPS noise

export type ParsedGpx = {
  distanceKm: number;
  elevationM: number;
  pointCount: number;
};

export function parseGpx(xml: string): ParsedGpx {
  const points: GpxPoint[] = [];
  let match: RegExpExecArray | null;
  TRKPT_RE.lastIndex = 0;
  while ((match = TRKPT_RE.exec(xml)) !== null) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const inner = match[3] ?? "";
    const eleMatch = ELE_RE.exec(inner);
    const eleNum = eleMatch ? Number(eleMatch[1]) : NaN;
    points.push({ lat, lng, ele: Number.isFinite(eleNum) ? eleNum : undefined });
  }

  if (points.length < 2) {
    throw new Error("Could not read any track points from the GPX file.");
  }

  let distanceM = 0;
  let elevationM = 0;

  for (let i = 1; i < points.length; i++) {
    distanceM += haversine(points[i - 1], points[i]);
    const prevEle = points[i - 1].ele;
    const curEle = points[i].ele;
    if (prevEle != null && curEle != null) {
      const delta = curEle - prevEle;
      if (delta > ELE_NOISE_THRESHOLD_M) elevationM += delta;
    }
  }

  return {
    distanceKm: Math.round((distanceM / 1000) * 10) / 10,
    elevationM: Math.round(elevationM),
    pointCount: points.length,
  };
}

function haversine(a: GpxPoint, b: GpxPoint): number {
  const R = 6371000; // earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Extract just the [lat, lng] coordinates from a GPX file for map rendering.
 * Decimates by stride to keep the result ≤ MAX_POINTS — visually identical to
 * the full track at typical zoom levels but a fraction of the JSON payload.
 */
const MAX_POINTS = 2000;

export function parseGpxCoords(xml: string): [number, number][] {
  const all: [number, number][] = [];
  let match: RegExpExecArray | null;
  TRKPT_RE.lastIndex = 0;
  while ((match = TRKPT_RE.exec(xml)) !== null) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) all.push([lat, lng]);
  }
  if (all.length <= MAX_POINTS) return all;

  // Stride-decimate. Always keep the first and last points so the start
  // pin and the endpoint of the line remain accurate.
  const stride = Math.ceil(all.length / MAX_POINTS);
  const out: [number, number][] = [];
  for (let i = 0; i < all.length; i += stride) out.push(all[i]);
  if (out[out.length - 1] !== all[all.length - 1]) out.push(all[all.length - 1]);
  return out;
}
