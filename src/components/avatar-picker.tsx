"use client";

import { useState } from "react";

const MAX_DIMENSION = 1024;
const SKIP_RESIZE_BELOW = 500 * 1024; // 500KB
const JPEG_QUALITY = 0.85;

/**
 * Resize an image client-side via canvas. Returns the resized File ready to
 * be sent in the form. If the source is already small, returns it unchanged.
 *
 * Caps the largest dimension at 1024px and re-encodes as JPEG. Server still
 * does the final 512×512 crop via sharp; this just stops phone-sized photos
 * (4–8 MB JPEG/HEIC) from blowing past the gateway / Next.js body limits.
 */
async function resizeImage(file: File): Promise<File> {
  if (file.size < SKIP_RESIZE_BELOW) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    throw new Error("Could not read that image. Try JPEG, PNG, or WebP.");
  }

  const ratio = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height, 1);
  if (ratio >= 1) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser could not create a canvas to resize.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Could not encode the resized image.");

  const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function AvatarPicker({
  currentImage,
  fallbackInitial,
}: {
  currentImage: string | null;
  fallbackInitial: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Pick an image (JPEG, PNG, or WebP).");
      input.value = "";
      return;
    }

    setError(null);
    setWorking(true);

    try {
      const resized = await resizeImage(file);

      // Swap the input's selected file with the resized version so the form
      // submission carries the smaller payload. DataTransfer is the supported
      // way to assign files programmatically (works in Chrome/Edge/Firefox/
      // Safari 14.1+).
      const dt = new DataTransfer();
      dt.items.add(resized);
      input.files = dt.files;

      setPreviewUrl(URL.createObjectURL(resized));
      setFilename(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process image.");
      input.value = "";
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex items-start gap-4">
      <label className="cursor-pointer shrink-0">
        <span className="block size-20 hex-clip overflow-hidden bg-coral-200">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="size-full flex items-center justify-center text-coral-800 font-display text-2xl font-bold">
              {fallbackInitial}
            </span>
          )}
        </span>
        <input
          type="file"
          name="avatar"
          accept="image/*"
          onChange={handleChange}
          disabled={working}
          className="sr-only"
        />
      </label>
      <div className="text-sm text-ink-soft min-w-0">
        <p className="font-medium text-ink">
          {working
            ? "Resizing…"
            : filename
              ? "New photo selected"
              : "Tap the badge to change photo"}
        </p>
        <p className="text-xs mt-0.5">
          Auto-resized in your browser. Any image, any size — no upload limit
          to worry about.
        </p>
        {filename && !error && (
          <p className="text-xs text-coral-700 mt-1 truncate">{filename}</p>
        )}
        {error && <p className="text-xs text-flash-600 mt-1">{error}</p>}
      </div>
    </div>
  );
}
