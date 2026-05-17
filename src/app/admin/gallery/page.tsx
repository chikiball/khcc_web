import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { desc } from "drizzle-orm";
import { GalleryUploader, DeletePhotoButton } from "@/components/gallery-uploader";
import { updateGalleryAlt } from "./actions";

export const metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function AdminGalleryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const photos = await db
    .select()
    .from(schema.galleryPhotos)
    .orderBy(desc(schema.galleryPhotos.createdAt));

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Gallery</h1>
      <p className="text-sm text-ink-soft mt-1">
        Photos shown on the public landing page. Newest first. Square 1024×1024
        JPEGs after server resize — upload anything, we&apos;ll handle it.
      </p>

      {saved && (
        <div className="mt-4 rounded-2xl bg-coral-100 ring-1 ring-coral-300 px-4 py-3 text-sm text-coral-800">
          ✓ Photo uploaded.
        </div>
      )}

      <div className="mt-6">
        <GalleryUploader />
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold">In the showcase</h2>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {photos.length === 0 && (
          <li className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-6 text-center text-sm text-ink-soft sm:col-span-2">
            No photos yet — upload the first one above.
          </li>
        )}
        {photos.map((photo) => {
          const action = updateGalleryAlt.bind(null, photo.id);
          return (
            <li
              key={photo.id}
              className="rounded-2xl bg-white ring-1 ring-maroon-200/60 overflow-hidden"
            >
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.imageUrl}
                  alt={photo.alt}
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
              <form action={action} className="p-3 space-y-2">
                <input
                  name="alt"
                  type="text"
                  defaultValue={photo.alt}
                  placeholder="Alt text"
                  className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-xs outline-none"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    className="text-xs text-coral-700 hover:text-coral-800 font-medium"
                  >
                    Save alt
                  </button>
                  <DeletePhotoButton photoId={photo.id} />
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
