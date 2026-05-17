import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
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
