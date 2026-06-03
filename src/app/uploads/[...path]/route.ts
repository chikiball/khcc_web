import { NextResponse, type NextRequest } from "next/server";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";

// Next.js standalone snapshots /public at build time — files written at
// runtime under /public/uploads/* are NOT in that manifest and 404 from the
// static handler. This Route Handler reads them directly from disk so any
// admin upload becomes immediately visible.
//
// Path traversal defence:
//   - exactly two segments (subdir + filename), no nesting
//   - subdir must be in the explicit allowlist
//   - no `..`, no `/`, no `\` in any segment
//   - extension must be a known image type

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  gpx: "application/gpx+xml",
};

const ALLOWED_SUBDIRS = new Set(["avatars", "gallery", "routes", "library", "ride-photos"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (
    !segments ||
    segments.length !== 2 ||
    !ALLOWED_SUBDIRS.has(segments[0]) ||
    segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [subdir, filename] = segments;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME[ext];
  if (!contentType) return new NextResponse("Not found", { status: 404 });

  const filePath = path.join(process.cwd(), "public", "uploads", subdir, filename);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!fileStat.isFile()) return new NextResponse("Not found", { status: 404 });

  const data = await readFile(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      // Filenames embed the user/photo id, so URLs are unique per upload —
      // safe to cache aggressively.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
