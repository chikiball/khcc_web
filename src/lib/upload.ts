import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Avatars live under /app/public/uploads/avatars in the container.
// docker-compose bind-mounts ./uploads on the host to /app/public/uploads
// so files survive container rebuilds. Next.js serves /public/* at the
// root, so the public URL is /uploads/avatars/<file>.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const PUBLIC_PREFIX = "/uploads/avatars";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB pre-resize cap (matches bodySizeLimit)
const SIZE = 512;

/**
 * Resize an uploaded image to a 512×512 JPEG, write it to disk, return
 * the public URL. Honours EXIF orientation. Output filenames are scoped
 * by user id + timestamp so concurrent uploads don't collide and the
 * URL changes (busts any browser/CDN cache).
 *
 * Throws on:
 *   - non-image File
 *   - file > MAX_BYTES
 *   - sharp can't decode (e.g. corrupted, unsupported format like HEIC)
 */
export async function processAvatar(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image (JPEG, PNG, or WebP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too big (10 MB max).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let resized: Buffer;
  try {
    resized = await sharp(buffer)
      .rotate() // honour EXIF orientation
      .resize(SIZE, SIZE, { fit: "cover", position: "center" })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("Could not read that image. Try JPEG, PNG, or WebP.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${userId}-${Date.now()}.jpg`;
  await writeFile(path.join(UPLOAD_DIR, filename), resized);

  return `${PUBLIC_PREFIX}/${filename}`;
}
