import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { asc } from "drizzle-orm";
import { COLOR_KEYS, COLORS, colorClasses } from "@/lib/ride-types";
import { createRideType, updateRideType, deleteRideType } from "./actions";

export const metadata = { title: "Ride types" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function AdminTypesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const types = await db
    .select()
    .from(schema.rideTypes)
    .orderBy(asc(schema.rideTypes.position));

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Ride types</h1>
      <p className="text-sm text-ink-soft mt-1">
        Pace groups shown on rides and member profiles. Inactive types are
        hidden from new pickers but stay attached to existing rows.
      </p>

      {saved && (
        <div className="mt-4 rounded-2xl bg-coral-100 ring-1 ring-coral-300 px-4 py-3 text-sm text-coral-800">
          ✓ Saved.
        </div>
      )}

      <h2 className="mt-8 font-display text-xl font-semibold">Existing</h2>
      <ul className="mt-4 space-y-3">
        {types.map((t) => {
          const tone = colorClasses(t.color);
          return (
            <li key={t.code} className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4">
              <form action={updateRideType.bind(null, t.code)} className="space-y-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl font-display font-bold text-lg ring-1 shrink-0 ${tone.bg} ${tone.text} ${tone.ring}`}
                  >
                    {t.code}
                  </span>
                  <input
                    name="code"
                    type="hidden"
                    defaultValue={t.code}
                  />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      name="name"
                      defaultValue={t.name}
                      required
                      placeholder="Name"
                      className="rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                    />
                    <input
                      name="position"
                      type="number"
                      defaultValue={t.position}
                      placeholder="Position"
                      className="rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>

                <textarea
                  name="description"
                  defaultValue={t.description ?? ""}
                  rows={2}
                  placeholder="Short description"
                  className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                />

                <ColorPicker name="color" defaultValue={t.color} />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={t.active}
                      className="size-4"
                    />
                    Active
                  </label>
                  <div className="flex items-center gap-3">
                    <DeleteForm code={t.code} />
                    <button
                      type="submit"
                      className="text-sm text-coral-700 hover:text-coral-800 font-medium"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-display text-xl font-semibold">Add new</h2>
      <form
        action={createRideType}
        className="mt-4 rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4 space-y-3"
      >
        <div className="grid grid-cols-3 gap-2">
          <input
            name="code"
            required
            placeholder="Code (e.g. D)"
            maxLength={8}
            className="rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none uppercase"
          />
          <input
            name="name"
            required
            placeholder="Name"
            className="col-span-2 rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
          />
        </div>
        <textarea
          name="description"
          rows={2}
          placeholder="Short description (optional)"
          className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
        />
        <ColorPicker name="color" defaultValue="coral" />
        <div className="flex items-center justify-between gap-3">
          <input
            name="position"
            type="number"
            defaultValue={String((types[types.length - 1]?.position ?? 0) + 1)}
            placeholder="Position"
            className="rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none w-24"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked className="size-4" />
            Active
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-4 py-2 text-sm font-semibold"
          >
            Add type
          </button>
        </div>
      </form>
    </main>
  );
}

function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <div>
      <span className="block text-xs text-ink-soft mb-1">Color</span>
      <div className="flex flex-wrap gap-2">
        {COLOR_KEYS.map((key) => (
          <label
            key={key}
            title={COLORS[key].label}
            className="cursor-pointer"
          >
            <input
              type="radio"
              name={name}
              value={key}
              defaultChecked={defaultValue === key}
              className="sr-only peer"
            />
            <span
              className={`inline-block size-8 rounded-full ring-2 ring-transparent peer-checked:ring-ink ${COLORS[key].swatch}`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function DeleteForm({ code }: { code: string }) {
  const action = deleteRideType.bind(null, code);
  return (
    <form action={action} className="inline">
      <button
        type="submit"
        className="text-xs text-maroon-700 hover:text-maroon-800"
        title="Only deletable if no rides or users reference this type"
      >
        Delete
      </button>
    </form>
  );
}
