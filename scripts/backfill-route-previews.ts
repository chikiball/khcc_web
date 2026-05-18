/**
 * Backfill static-map preview images for any ride that has a .gpx file
 * but no <rideId>-preview.jpg yet. Idempotent — skips rides that already
 * have a preview.
 *
 * Run via:
 *   docker exec khcc-web node node_modules/tsx/dist/cli.mjs scripts/backfill-route-previews.ts
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseGpxCoords } from "../src/lib/gpx";
import { generateRoutePreview } from "../src/lib/static-map";

const ROUTES_DIR = path.join(process.cwd(), "public", "uploads", "routes");

async function main() {
  let entries: string[];
  try {
    entries = await readdir(ROUTES_DIR);
  } catch (err) {
    console.error(`Cannot read ${ROUTES_DIR}:`, err);
    process.exit(1);
  }

  const gpxFiles = entries.filter((f) => f.endsWith(".gpx"));
  console.log(`Found ${gpxFiles.length} .gpx file(s) under ${ROUTES_DIR}`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of gpxFiles) {
    const rideId = file.replace(/\.gpx$/, "");
    const previewPath = path.join(ROUTES_DIR, `${rideId}-preview.jpg`);

    try {
      const s = await stat(previewPath);
      if (s.isFile()) {
        console.log(`  ${rideId}: preview already exists, skipping`);
        skipped++;
        continue;
      }
    } catch {
      // No preview yet — proceed
    }

    try {
      const xml = await readFile(path.join(ROUTES_DIR, file), "utf8");
      const coords = parseGpxCoords(xml);
      if (coords.length < 2) {
        console.log(`  ${rideId}: only ${coords.length} point(s), skipping`);
        skipped++;
        continue;
      }
      process.stdout.write(`  ${rideId}: generating from ${coords.length} points… `);
      await generateRoutePreview(coords, rideId);
      console.log("✓");
      generated++;
      // OSM tile-usage etiquette: don't hammer. ~250ms gap between rides.
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      console.log("✗", err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
