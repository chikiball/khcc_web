/**
 * Backfill square thumbnails for ride-recap photos uploaded before thumbnail
 * generation existed. For each /uploads/ride-photos/<id>.jpg with no matching
 * <id>-thumb.jpg, generate the thumb via sharp. Idempotent — skips photos that
 * already have a thumb.
 *
 * Run via:
 *   docker exec burkam-web node node_modules/tsx/dist/cli.mjs scripts/backfill-ride-photo-thumbs.ts
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { RIDE_PHOTO_THUMB_SIZE } from "../src/lib/upload";

const PHOTOS_DIR = path.join(process.cwd(), "public", "uploads", "ride-photos");
const THUMB_SUFFIX = "-thumb.jpg";

async function main() {
  let entries: string[];
  try {
    entries = await readdir(PHOTOS_DIR);
  } catch (err) {
    console.error(`Cannot read ${PHOTOS_DIR}:`, err);
    process.exit(1);
  }

  const mains = entries.filter((f) => f.endsWith(".jpg") && !f.endsWith(THUMB_SUFFIX));
  console.log(`Found ${mains.length} ride photo(s) under ${PHOTOS_DIR}`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of mains) {
    const id = file.replace(/\.jpg$/, "");
    const thumbName = `${id}${THUMB_SUFFIX}`;
    const thumbPath = path.join(PHOTOS_DIR, thumbName);

    try {
      const s = await stat(thumbPath);
      if (s.isFile()) {
        skipped++;
        continue;
      }
    } catch {
      // No thumb yet — proceed
    }

    try {
      process.stdout.write(`  ${id}: generating thumb… `);
      await sharp(path.join(PHOTOS_DIR, file))
        .rotate()
        .resize(RIDE_PHOTO_THUMB_SIZE, RIDE_PHOTO_THUMB_SIZE, { fit: "cover", position: "center" })
        .jpeg({ quality: 85, progressive: true, mozjpeg: true })
        .toFile(thumbPath);
      console.log("✓");
      generated++;
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
