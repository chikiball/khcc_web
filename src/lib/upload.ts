import sharp from "sharp";
import { writeFile, mkdir, copyFile } from "node:fs/promises";
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

async function processImage(
  file: File,
  opts: {
    subdir: string;
    filename: string;
    size: number;
    fit: "cover" | "inside";
  },
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pick an image (JPEG, PNG, or WebP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too big (10 MB max).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let resized: Buffer;
  try {
    resized = await sharp(buffer)
      .rotate()
      .resize(opts.size, opts.size, { fit: opts.fit, position: "center" })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("Could not read that image. Try JPEG, PNG, or WebP.");
  }

  const dir = path.join(PUBLIC_ROOT, opts.subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, opts.filename), resized);

  return `/uploads/${opts.subdir}/${opts.filename}`;
}
