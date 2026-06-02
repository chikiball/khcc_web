import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { desc } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  RouteLibraryUploader,
  DeleteRouteEntryButton,
} from "@/components/route-library-uploader";
import { updateRouteLibraryEntry } from "./actions";

export const metadata = { title: "Route library" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string; error?: string }>;

export default async function AdminRoutesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { saved, error } = await searchParams;

  const routes = await db
    .select()
    .from(schema.routeLibrary)
    .orderBy(desc(schema.routeLibrary.createdAt));

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Route library</h1>
      <p className="text-sm text-ink-soft mt-1">
        Pre-uploaded GPX tracks the ride form can pick from. Saves
        re-uploading the same routes every weekend.
      </p>

      {saved && (
        <div className="mt-4 rounded-2xl bg-coral-100 ring-1 ring-coral-300 px-4 py-3 text-sm text-coral-800">
          ✓ Saved.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl bg-flash-100 ring-1 ring-flash-300 px-4 py-3 text-sm text-flash-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        <RouteLibraryUploader />
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold">In the library</h2>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {routes.length === 0 && (
          <li className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-6 text-center text-sm text-ink-soft sm:col-span-2">
            No routes yet — upload the first one above.
          </li>
        )}
        {routes.map((route) => {
          const action = updateRouteLibraryEntry.bind(null, route.id);
          const previewPath = path.join(
            process.cwd(),
            "public",
            "uploads",
            "library",
            `${route.id}-preview.jpg`,
          );
          const hasPreview = existsSync(previewPath);
          return (
            <li
              key={route.id}
              className="rounded-2xl bg-white ring-1 ring-maroon-200/60 overflow-hidden"
            >
              {hasPreview ? (
                <div className="relative aspect-[2/1] bg-cream-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/uploads/library/${route.id}-preview.jpg`}
                    alt={`Map preview of ${route.name}`}
                    className="absolute inset-0 size-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[2/1] bg-cream-100 flex items-center justify-center text-xs text-ink-soft">
                  No preview
                </div>
              )}

              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-ink-soft">
                  {route.distanceKm && <span>{route.distanceKm} km</span>}
                  {route.elevationM != null && (
                    <>
                      <span className="text-ink-soft/50">·</span>
                      <span>{route.elevationM} m elev</span>
                    </>
                  )}
                  <a
                    href={`/uploads/library/${route.id}.gpx`}
                    download
                    className="ml-auto text-coral-700 hover:text-coral-800"
                  >
                    GPX ↓
                  </a>
                </div>

                <form action={action} className="space-y-2">
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={route.name}
                    placeholder="Name"
                    className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                  />
                  <textarea
                    name="description"
                    defaultValue={route.description ?? ""}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-xs outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="submit"
                      className="text-xs text-coral-700 hover:text-coral-800 font-medium"
                    >
                      Save
                    </button>
                    <DeleteRouteEntryButton id={route.id} />
                  </div>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
