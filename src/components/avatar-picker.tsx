"use client";

import { useState } from "react";

export function AvatarPicker({
  currentImage,
  fallbackInitial,
}: {
  currentImage: string | null;
  fallbackInitial: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage);
  const [filename, setFilename] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFilename(file.name);
  };

  return (
    <div className="flex items-center gap-4">
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
          className="sr-only"
        />
      </label>
      <div className="text-sm text-ink-soft">
        <p className="font-medium text-ink">
          {filename ? "New photo selected" : "Tap the badge to change photo"}
        </p>
        <p className="text-xs mt-0.5">JPEG, PNG, or WebP. Up to 10 MB. Cropped to square.</p>
        {filename && (
          <p className="text-xs text-coral-700 mt-1 truncate max-w-[220px]">{filename}</p>
        )}
      </div>
    </div>
  );
}
