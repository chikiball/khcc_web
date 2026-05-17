import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { asc } from "drizzle-orm";
import { updateContentBlock } from "./actions";

export const metadata = { title: "Content" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const blocks = await db
    .select()
    .from(schema.contentBlocks)
    .orderBy(asc(schema.contentBlocks.key));

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Landing-page content</h1>
      <p className="text-sm text-ink-soft mt-1">
        These sections appear on the public home page. Plain text — blank lines
        become paragraph breaks.
      </p>

      {saved && (
        <div className="mt-4 rounded-2xl bg-coral-100 ring-1 ring-coral-300 px-4 py-3 text-sm text-coral-800">
          ✓ Saved.
        </div>
      )}

      <div className="mt-8 space-y-10">
        {blocks.map((block) => (
          <BlockEditor key={block.key} block={block} />
        ))}
      </div>
    </main>
  );
}

function BlockEditor({
  block,
}: {
  block: { key: string; title: string; body: string; updatedAt: Date };
}) {
  const action = updateContentBlock.bind(null, block.key);

  return (
    <form action={action} className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-coral-600">
          #{block.key}
        </span>
        <span className="text-xs text-ink-soft/70">
          Last edited {new Date(block.updatedAt).toLocaleDateString()}
        </span>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1">Title</span>
        <input
          name="title"
          required
          defaultValue={block.title}
          className="w-full rounded-xl bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1">Body</span>
        <textarea
          name="body"
          required
          rows={8}
          defaultValue={block.body}
          className="w-full rounded-xl bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-sm outline-none font-mono leading-relaxed"
        />
      </label>

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        Save {block.key}
      </button>
    </form>
  );
}
