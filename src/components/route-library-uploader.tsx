"use client";

import { useState, useTransition } from "react";
import { uploadRouteToLibrary, deleteRouteLibraryEntry } from "@/app/admin/routes/actions";

export function RouteLibraryUploader() {
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) {
      setFilename(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("Pick a .gpx file.");
      input.value = "";
      setFilename(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("GPX file is too big (5 MB max).");
      input.value = "";
      setFilename(null);
      return;
    }
    setError(null);
    setFilename(file.name);
  };

  return (
    <form
      action={uploadRouteToLibrary}
      encType="multipart/form-data"
      className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-5 space-y-4"
    >
      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1">Name</span>
        <input
          name="name"
          type="text"
          required
          placeholder="East Coast → Changi Village loop"
          className="w-full rounded-xl bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-sm outline-none"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1">Description (optional)</span>
        <textarea
          name="description"
          rows={2}
          placeholder="Single-pace, flat, ~50 km."
          className="w-full rounded-xl bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-sm outline-none"
        />
      </label>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">GPX file</label>
        <label className="block cursor-pointer rounded-xl ring-1 ring-maroon-200 ring-dashed bg-cream-50 hover:bg-cream-100 px-4 py-6 text-center">
          <p className="text-sm text-ink-soft">
            {filename ? "Change file" : "Click to pick a .gpx file"}
          </p>
          {filename && <p className="text-xs text-coral-700 mt-2 truncate">{filename}</p>}
          <input
            type="file"
            name="gpx"
            accept=".gpx,application/gpx+xml,application/xml"
            required
            onChange={handleChange}
            className="sr-only"
          />
        </label>
        {error && <p className="text-xs text-flash-600 mt-2">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={!filename}
        className="w-full inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 disabled:opacity-50 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        Upload route
      </button>
    </form>
  );
}

export function DeleteRouteEntryButton({ id }: { id: string }) {
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
        onClick={() => startTransition(async () => deleteRouteLibraryEntry(id))}
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
