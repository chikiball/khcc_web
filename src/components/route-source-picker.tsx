"use client";

import { useRef, useState } from "react";

export type LibraryRouteOption = { id: string; name: string };

export function RouteSourcePicker({
  libraryRoutes,
}: {
  libraryRoutes: LibraryRouteOption[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [mode, setMode] = useState<"none" | "library" | "upload">("none");
  const [libraryName, setLibraryName] = useState<string>("");
  const [uploadName, setUploadName] = useState<string>("");

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) {
      setMode("none");
      setLibraryName("");
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadName("");
    setLibraryName(libraryRoutes.find((r) => r.id === id)?.name ?? "");
    setMode("library");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (mode === "upload") setMode("none");
      setUploadName("");
      return;
    }
    if (selectRef.current) selectRef.current.value = "";
    setLibraryName("");
    setUploadName(file.name);
    setMode("upload");
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-ink">Route (optional)</span>

      {libraryRoutes.length > 0 && (
        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">
            Pick from library
          </span>
          <select
            ref={selectRef}
            name="library_route_id"
            defaultValue=""
            onChange={handleSelectChange}
            className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
          >
            <option value="">— No library route —</option>
            {libraryRoutes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="block text-xs text-ink-soft mb-1">
          {libraryRoutes.length > 0 ? "Or upload a GPX file" : "Upload a GPX file"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          name="gpx"
          accept=".gpx,application/gpx+xml,application/xml"
          onChange={handleFileChange}
          className="block w-full text-sm text-ink-soft file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cream-100 file:text-ink hover:file:bg-cream-200 file:cursor-pointer"
        />
      </label>

      {mode === "library" && (
        <p className="text-xs text-coral-700">
          📍 <span className="font-medium">{libraryName}</span> selected
        </p>
      )}
      {mode === "upload" && (
        <p className="text-xs text-coral-700">
          📁 <span className="font-medium">{uploadName}</span> selected
        </p>
      )}
      {mode === "none" && (
        <p className="text-xs text-ink-soft">
          Distance and elevation will be replaced with values parsed from the route.
        </p>
      )}
    </div>
  );
}
