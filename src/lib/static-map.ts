import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Generate a static preview image of a GPX route: stitch OpenStreetMap
 * tiles for the route's bounding box and draw the polyline over them as
 * an SVG overlay. Saved as a JPEG under /uploads/routes/<id>-preview.jpg
 * and shown as the banner image on each ride card in the rides list.
 *
 * Called once per GPX upload — the resulting image is cached on disk
 * indefinitely and never re-fetched until the next upload. This keeps
 * us well within the OSM tile-usage policy: a few requests per upload
 * with an identifying User-Agent.
 *
 * Slippy-map math reference:
 *   https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */

const TILE_SIZE = 256;
const USER_AGENT = "Burkam-Web/0.1 (https://burkam.nandharu.uk)";
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

const IMG_W = 600;
const IMG_H = 300;
const PADDING_PX = 30;
const ROUTE_COLOR = "#1e40af"; // matches the live map's polyline
const ROUTE_WIDTH = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 17;
const FETCH_TIMEOUT_MS = 8000;

// World pixel coordinates at a given zoom level
function lonToPxX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z) * TILE_SIZE;
}
function latToPxY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, z) *
    TILE_SIZE
  );
}

function pickZoom(north: number, south: number, east: number, west: number): number {
  const usableW = IMG_W - PADDING_PX * 2;
  const usableH = IMG_H - PADDING_PX * 2;
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const w = lonToPxX(east, z) - lonToPxX(west, z);
    const h = latToPxY(south, z) - latToPxY(north, z);
    if (w <= usableW && h <= usableH) return z;
  }
  return MIN_ZOOM;
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(TILE_URL(z, x, y), {
      headers: { "User-Agent": USER_AGENT },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`OSM tile ${z}/${x}/${y} → ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

export async function generateRoutePreview(
  coords: [number, number][],
  rideId: string,
): Promise<string> {
  if (coords.length < 2) {
    throw new Error("Need at least 2 coordinates to render a preview.");
  }

  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const N = Math.max(...lats);
  const S = Math.min(...lats);
  const E = Math.max(...lngs);
  const W = Math.min(...lngs);

  const z = pickZoom(N, S, E, W);
  const tilesAtZoom = Math.pow(2, z);

  // World-pixel coords of the bbox at the chosen zoom
  const minX = lonToPxX(W, z);
  const maxX = lonToPxX(E, z);
  const minY = latToPxY(N, z); // north has the smaller pixel-Y
  const maxY = latToPxY(S, z);

  // Centre the bbox in the image
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const originX = centerX - IMG_W / 2;
  const originY = centerY - IMG_H / 2;

  // Tiles covering the image area
  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + IMG_W) / TILE_SIZE);
  const minTileY = Math.floor(originY / TILE_SIZE);
  const maxTileY = Math.floor((originY + IMG_H) / TILE_SIZE);

  const fetches: Promise<{ tx: number; ty: number; data: Buffer }>[] = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      // Skip poles (no tiles outside [0, 2^z))
      if (ty < 0 || ty >= tilesAtZoom) continue;
      // Wrap longitudinally
      const xWrapped = ((tx % tilesAtZoom) + tilesAtZoom) % tilesAtZoom;
      fetches.push(
        fetchTile(z, xWrapped, ty).then((data) => ({ tx, ty, data })),
      );
    }
  }
  const tiles = await Promise.all(fetches);

  // Compose tiles
  const composites: sharp.OverlayOptions[] = tiles.map(({ tx, ty, data }) => ({
    input: data,
    left: Math.round(tx * TILE_SIZE - originX),
    top: Math.round(ty * TILE_SIZE - originY),
  }));

  // Draw polyline in SVG over the composed tiles
  const polylinePoints = coords
    .map(([lat, lng]) => {
      const px = lonToPxX(lng, z) - originX;
      const py = latToPxY(lat, z) - originY;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  const svg = Buffer.from(
    `<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
      <polyline points="${polylinePoints}" fill="none" stroke="${ROUTE_COLOR}" stroke-width="${ROUTE_WIDTH}" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
    </svg>`,
  );
  composites.push({ input: svg, left: 0, top: 0 });

  const out = await sharp({
    create: {
      width: IMG_W,
      height: IMG_H,
      channels: 3,
      background: "#e5e5e5",
    },
  })
    .composite(composites)
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();

  const dir = path.join(process.cwd(), "public", "uploads", "routes");
  await mkdir(dir, { recursive: true });
  const filename = `${rideId}-preview.jpg`;
  await writeFile(path.join(dir, filename), out);
  return `/uploads/routes/${filename}`;
}
