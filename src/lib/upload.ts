import sharp from "sharp";
import { writeFile, mkdir, copyFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

const PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads");

const MAX_BYTES = 10 * 1024 * 1024; // 10MB pre-resize cap (matches bodySizeLimit)

/**
 * Resize an uploaded image to a 512×512 JPEG, write it under
 * /uploads/avatars/, return the public URL. Honours EXIF orientation.
 * Output filenames are scoped by user id + timestamp so concurrent uploads
 * don't collide and the URL changes (busts any browser/CDN cache).
 */
export async function processAvatar(file: File, userId: string): Promise<string> {
  return processImage(file, {
    subdir: "avatars",
    filename: `${userId}-${Date.now()}.jpg`,
    size: 512,
    fit: "cover",
  });
}

/**
 * Resize an uploaded gallery photo to 1024×1024 JPEG (centre-cropped to
 * square — the landing-page gallery is laid out in square tiles), write
 * under /uploads/gallery/, return the public URL.
 */
export async function processGalleryPhoto(file: File, photoId: string): Promise<string> {
  return processImage(file, {
    subdir: "gallery",
    filename: `${photoId}.jpg`,
    size: 1024,
    fit: "cover",
  });
}

/**
 * Square thumbnail dimension for ride-recap photos. Drives the collage tiles
 * on /rides/past — small enough to keep that list light even when a ride has
 * a dozen photos, big enough to stay crisp on retina in a full-width tile.
 */
export const RIDE_PHOTO_THUMB_SIZE = 800;

/**
 * Derive the thumbnail URL/path for a ride photo from its full-size image URL
 * (`/uploads/ride-photos/<id>.jpg` → `…/<id>-thumb.jpg`). Kept as a pure string
 * transform so no thumb column is needed on `ride_photos`.
 */
export function ridePhotoThumbUrl(imageUrl: string): string {
  return imageUrl.replace(/\.jpg$/, "-thumb.jpg");
}

/**
 * Resize an uploaded ride-recap photo. Writes two files from one read of the
 * source:
 *   - `<photoId>.jpg` — full image, aspect preserved (fit: inside), max 1600px,
 *     used by the ride detail recap grid. Landscapes and portraits both render
 *     naturally.
 *   - `<photoId>-thumb.jpg` — square (fit: cover) RIDE_PHOTO_THUMB_SIZE thumb
 *     for the /rides/past collage.
 * The thumb is best-effort: a failure there must not sink the upload, since the
 * list falls back to the full image when the thumb is missing on disk.
 */
export async function processRidePhoto(file: File, photoId: string): Promise<string> {
  assertImage(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  const full = await resizeToJpeg(buffer, 1600, "inside");
  const url = await writeUpload("ride-photos", `${photoId}.jpg`, full);

  try {
    const thumb = await resizeToJpeg(buffer, RIDE_PHOTO_THUMB_SIZE, "cover");
    await writeUpload("ride-photos", `${photoId}-thumb.jpg`, thumb);
  } catch {
    // Full image already saved — the list gracefully falls back to it.
  }

  return url;
}

/**
 * Save an uploaded .gpx route file to /uploads/routes/<rideId>.gpx as-is
 * (no resize, no transformation). Caller is expected to have parsed the
 * file already to extract distance/elevation; we just persist the raw
 * bytes for future use (map line rendering, member download).
 */
export async function saveRouteGpx(file: File, rideId: string): Promise<string> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".gpx")) {
    throw new Error("Route file must end in .gpx.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("GPX file is too big (5 MB max).");
  }

  const dir = path.join(PUBLIC_ROOT, "routes");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, `${rideId}.gpx`), buffer);
  return `/uploads/routes/${rideId}.gpx`;
}

/**
 * Save an uploaded .gpx file to /uploads/library/<libraryId>.gpx as-is.
 * Used by the route library admin page.
 */
export async function saveLibraryGpx(file: File, libraryId: string): Promise<string> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".gpx")) {
    throw new Error("Route file must end in .gpx.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("GPX file is too big (5 MB max).");
  }

  const dir = path.join(PUBLIC_ROOT, "library");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, `${libraryId}.gpx`), buffer);
  return `/uploads/library/${libraryId}.gpx`;
}

/**
 * Copy a previously-uploaded library GPX into the per-ride slot at
 * /uploads/routes/<rideId>.gpx so the ride detail page can serve it
 * via the existing convention. Throws if the source file is missing.
 */
export async function copyLibraryGpxToRide(libraryId: string, rideId: string): Promise<string> {
  const src = path.join(PUBLIC_ROOT, "library", `${libraryId}.gpx`);
  const destDir = path.join(PUBLIC_ROOT, "routes");
  await mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, `${rideId}.gpx`);
  await copyFile(src, dest);
  return `/uploads/routes/${rideId}.gpx`;
}

/**
 * Series seed GPX — the canonical route for a recurring series, stored once
 * at /uploads/routes/series-<seriesId>.gpx. `materializeSeries` copies it
 * into each new occurrence's slot so every week gets the same map polyline,
 * GPX download, and static preview (not just the first ride). The `series-`
 * prefix can't collide with per-ride `<rideId>.gpx` files (both are UUIDs).
 */
const SERIES_SEED_PREFIX = "series-";

function seriesSeedPath(seriesId: string): string {
  return path.join(PUBLIC_ROOT, "routes", `${SERIES_SEED_PREFIX}${seriesId}.gpx`);
}

/** Persist the raw GPX text as a series' seed route. */
export async function saveSeriesSeedGpx(text: string, seriesId: string): Promise<void> {
  const dir = path.join(PUBLIC_ROOT, "routes");
  await mkdir(dir, { recursive: true });
  await writeFile(seriesSeedPath(seriesId), text, "utf8");
}

/** Whether a series already has a seed GPX on disk. */
export async function seriesSeedExists(seriesId: string): Promise<boolean> {
  try {
    await readFile(seriesSeedPath(seriesId), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Backfill a series' seed from an existing occurrence's per-ride GPX
 * (/uploads/routes/<rideId>.gpx) — used for series created before seeding
 * existed. Returns true if a seed was written. Best-effort, never throws.
 */
export async function promoteRideGpxToSeriesSeed(
  rideId: string,
  seriesId: string,
): Promise<boolean> {
  const src = path.join(PUBLIC_ROOT, "routes", `${rideId}.gpx`);
  try {
    const text = await readFile(src, "utf8");
    await mkdir(path.join(PUBLIC_ROOT, "routes"), { recursive: true });
    await writeFile(seriesSeedPath(seriesId), text, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a series' seed GPX into the per-ride slot at /uploads/routes/<rideId>.gpx.
 * Returns the raw GPX text on success (caller regenerates the preview from it),
 * or null when the series has no seed on disk (best-effort, never throws).
 */
export async function copySeriesSeedGpxToRide(
  seriesId: string,
  rideId: string,
): Promise<string | null> {
  const src = seriesSeedPath(seriesId);
  try {
    const text = await readFile(src, "utf8");
    const dir = path.join(PUBLIC_ROOT, "routes");
    await mkdir(dir, { recursive: true });
    await copyFile(src, path.join(dir, `${rideId}.gpx`));
    return text;
  } catch {
    return null;
  }
}

function assertImage(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pick an image (JPEG, PNG, or WebP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too big (10 MB max).");
  }
}

async function resizeToJpeg(
  buffer: Buffer,
  size: number,
  fit: "cover" | "inside",
): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize(size, size, { fit, position: "center" })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("Could not read that image. Try JPEG, PNG, or WebP.");
  }
}

async function writeUpload(subdir: string, filename: string, data: Buffer): Promise<string> {
  const dir = path.join(PUBLIC_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), data);
  return `/uploads/${subdir}/${filename}`;
}

/**
 * Delete a ride photo's on-disk files — both the full `<photoId>.jpg` and its
 * `<photoId>-thumb.jpg` thumbnail. Best-effort: missing files (or a thumb that
 * was never generated) are ignored, so this never throws and can't block the
 * DB delete that follows it.
 */
export async function deleteRidePhotoFiles(photoId: string): Promise<void> {
  const dir = path.join(PUBLIC_ROOT, "ride-photos");
  await Promise.all(
    [`${photoId}.jpg`, `${photoId}-thumb.jpg`].map(async (name) => {
      try {
        await unlink(path.join(dir, name));
      } catch {
        // Already gone / never existed — nothing to reclaim.
      }
    }),
  );
}

async function processImage(
  file: File,
  opts: {
    subdir: string;
    filename: string;
    size: number;
    fit: "cover" | "inside";
  },
): Promise<string> {
  assertImage(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const resized = await resizeToJpeg(buffer, opts.size, opts.fit);
  return writeUpload(opts.subdir, opts.filename, resized);
}
