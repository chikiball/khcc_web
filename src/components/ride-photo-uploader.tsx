"use client";

import { useRef, useState, useTransition } from "react";
import { uploadRidePhoto, deleteRidePhoto } from "@/app/rides/actions";

const MAX_DIMENSION = 2000;
const SKIP_RESIZE_BELOW = 1024 * 1024;

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

export function RidePhotoUploader({
  rideId,
  uploadsRemaining,
}: {
  rideId: string;
  uploadsRemaining: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (uploadsRemaining <= 0) {
    return (
      <p className="text-xs text-ink-soft italic">
        You&apos;ve uploaded the maximum number of photos for this ride.
      </p>
    );
  }

  const action = uploadRidePhoto.bind(null, rideId);

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
      ref={formRef}
      action={action}
      encType="multipart/form-data"
      className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4 space-y-3"
      onSubmit={() => {
        // Reset preview state after submit; the page revalidates and the
        // uploaded photo appears in the grid below.
        setTimeout(() => {
          setFilename(null);
          setPreviewUrl(null);
          if (inputRef.current) inputRef.current.value = "";
        }, 0);
      }}
    >
      <label className="block cursor-pointer rounded-xl ring-1 ring-maroon-200 ring-dashed bg-cream-50 hover:bg-cream-100 px-4 py-5 text-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="mx-auto max-h-40 rounded-lg" />
        ) : (
          <p className="text-sm text-ink-soft">
            {working ? "Resizing…" : `Add a photo (${uploadsRemaining} left)`}
          </p>
        )}
        {filename && <p className="text-xs text-coral-700 mt-2 truncate">{filename}</p>}
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/*"
          required
          onChange={handleChange}
          disabled={working}
          className="sr-only"
        />
      </label>
      {error && <p className="text-xs text-flash-600">{error}</p>}
      <button
        type="submit"
        disabled={!filename}
        className="w-full inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 disabled:opacity-50 text-cream-50 px-5 py-2 text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        Post photo
      </button>
    </form>
  );
}

export function DeleteRidePhotoButton({ photoId }: { photoId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="absolute top-1 right-1 rounded-full bg-black/50 text-white text-xs px-2 py-0.5 hover:bg-black/70"
      >
        ×
      </button>
    );
  }

  return (
    <span className="absolute top-1 right-1 inline-flex items-center gap-1.5 text-xs bg-black/70 text-white rounded-full px-2 py-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => deleteRidePhoto(photoId))}
        className="font-semibold"
      >
        {pending ? "…" : "Delete"}
      </button>
      <span className="opacity-50">·</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="opacity-80"
      >
        Cancel
      </button>
    </span>
  );
}
