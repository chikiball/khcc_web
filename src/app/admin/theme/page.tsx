import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { DEFAULT_THEME, THEMES, THEME_BLOCK_KEY, isThemeKey } from "@/lib/themes";
import { eq } from "drizzle-orm";
import { setTheme } from "./actions";

export const metadata = { title: "Theme" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function AdminThemePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const { saved } = await searchParams;

  const [row] = await db
    .select({ body: schema.contentBlocks.body, updatedAt: schema.contentBlocks.updatedAt })
    .from(schema.contentBlocks)
    .where(eq(schema.contentBlocks.key, THEME_BLOCK_KEY))
    .limit(1);

  const active = row?.body && isThemeKey(row.body.trim()) ? row.body.trim() : DEFAULT_THEME;

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Theme</h1>
      <p className="text-sm text-ink-soft mt-1">
        Pick a colour scheme — applied to the whole site for everyone.
      </p>

      {saved && (
        <div className="mt-4 rounded-2xl bg-coral-100 ring-1 ring-coral-300 px-4 py-3 text-sm text-coral-800">
          ✓ Theme updated.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const isActive = t.key === active;
          return (
            <form key={t.key} action={setTheme}>
              <input type="hidden" name="theme" value={t.key} />
              <button
                type="submit"
                disabled={isActive}
                className={`w-full text-left rounded-2xl bg-white ring-1 transition-all overflow-hidden ${
                  isActive
                    ? "ring-2 ring-coral-500 shadow-sm cursor-default"
                    : "ring-maroon-200 hover:ring-maroon-300 hover:shadow-sm active:scale-[0.99]"
                }`}
              >
                <div className="flex h-12">
                  {t.swatches.map((c) => (
                    <div key={c} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-ink">{t.label}</h2>
                    {isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-coral-500 text-cream-50">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">{t.description}</p>
                </div>
              </button>
            </form>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Themes are defined in <code className="px-1 rounded bg-cream-100">src/lib/themes.ts</code> and{" "}
        <code className="px-1 rounded bg-cream-100">src/app/globals.css</code>. Adding one means a new
        registry entry plus a <code className="px-1 rounded bg-cream-100">[data-theme=&quot;...&quot;]</code>{" "}
        block.
      </p>
    </main>
  );
}
