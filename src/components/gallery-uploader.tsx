"use client";

import { useState, useTransition } from "react";
import { uploadGalleryPhoto, deleteGalleryPhoto } from "@/app/admin/gallery/actions";

const MAX_DIMENSION = 1600;
const SKIP_RESIZE_BELOW = 800 * 1024;

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
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not encode the resized image.");

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function GalleryUploader() {
  const [filename, setFilename] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    <form
      action={uploadGalleryPhoto}
      encType="multipart/form-data"
      className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-5 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Photo</label>
        <label className="block cursor-pointer rounded-xl ring-1 ring-maroon-200 ring-dashed bg-cream-50 hover:bg-cream-100 px-4 py-6 text-center">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="mx-auto max-h-40 rounded-lg" />
          ) : (
            <p className="text-sm text-ink-soft">
              {working ? "Resizing…" : "Click to pick a photo"}
            </p>
          )}
          {filename && <p className="text-xs text-coral-700 mt-2 truncate">{filename}</p>}
          <input
            type="file"
            name="photo"
            accept="image/*"
            required
            onChange={handleChange}
            disabled={working}
            className="sr-only"
          />
        </label>
        {error && <p className="text-xs text-flash-600 mt-2">{error}</p>}
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1">Alt text</span>
        <input
          name="alt"
          type="text"
          required
          placeholder="A short description for screen readers"
          className="w-full rounded-xl bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-sm outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={!filename}
        className="w-full inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 disabled:opacity-50 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        Upload photo
      </button>
    </form>
  );
}

export function DeletePhotoButton({ photoId }: { photoId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-maroon-700 hover:text-maroon-800 underline-offset-2 hover:underline"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => deleteGalleryPhoto(photoId))}
        className="text-maroon-700 hover:text-maroon-800 font-semibold"
      >
        {pending ? "…" : "Confirm"}
      </button>
      <span className="text-ink-soft/50">·</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-ink-soft hover:text-ink"
      >
        Cancel
      </button>
    </span>
  );
}
