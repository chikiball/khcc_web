import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { colorClasses } from "@/lib/ride-types";
import { completeOnboarding } from "./actions";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser();

  const [profile] = await db
    .select({
      name: schema.users.name,
      paceGroup: schema.users.paceGroup,
      bike: schema.users.bike,
      stravaHandle: schema.users.stravaHandle,
      onboardedAt: schema.users.onboardedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (profile?.onboardedAt) redirect("/rides");

  const rideTypes = await db
    .select()
    .from(schema.rideTypes)
    .where(eq(schema.rideTypes.active, true))
    .orderBy(asc(schema.rideTypes.position));

  const defaultCode = profile?.paceGroup ?? rideTypes[0]?.code ?? "B";

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-md mx-auto px-6 py-12">
        <span className="inline-block hex-clip bg-coral-400 text-cream-50 px-5 py-1.5 text-[10px] font-bold tracking-widest">
          BURKAM
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold leading-tight">
          One quick form, then we ride.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Should take 60 seconds.
        </p>

        <form action={completeOnboarding} className="mt-8 space-y-5">
          <Field
            label="Display name"
            name="display_name"
            required
            defaultValue={profile?.name ?? user.name ?? ""}
            placeholder="Wei"
          />

          <fieldset>
            <legend className="text-sm font-medium text-ink">Pace group</legend>
            <p className="text-xs text-ink-soft mt-0.5 mb-2">
              {rideTypes.map((t) => `${t.code} — ${t.name}`).join(" · ")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {rideTypes.map((t) => {
                const tone = colorClasses(t.color);
                return (
                  <label
                    key={t.code}
                    className="relative flex flex-col items-center justify-center rounded-2xl ring-1 ring-maroon-200 bg-white py-3 cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-coral-500 has-[:checked]:bg-coral-50 has-[:checked]:shadow-sm transition-all"
                    title={t.name}
                  >
                    <input
                      type="radio"
                      name="pace_group"
                      value={t.code}
                      defaultChecked={defaultCode === t.code}
                      className="sr-only peer"
                    />
                    <span className={`font-display font-bold text-xl ${tone.text}`}>{t.code}</span>
                    <span className="text-[10px] mt-0.5 text-ink-soft">{t.name}</span>
                    <span
                      aria-hidden
                      className="absolute top-1.5 right-1.5 size-4 rounded-full bg-coral-500 text-cream-50 text-[10px] font-bold leading-4 text-center opacity-0 peer-checked:opacity-100 transition-opacity"
                    >
                      ✓
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field
            label="Bike"
            name="bike"
            defaultValue={profile?.bike ?? ""}
            placeholder="Cervélo S5 — optional"
          />

          <Field
            label="Strava handle"
            name="strava_handle"
            defaultValue={profile?.stravaHandle ?? ""}
            placeholder="@burkam.rider — optional"
          />

          <div className="pt-3">
            <h2 className="text-sm font-semibold text-ink">Emergency contact</h2>
            <p className="text-xs text-ink-soft">
              Private. Only visible to admins (and to your ride leader, in a
              future update).
            </p>
            <div className="mt-3 space-y-3">
              <Field label="Name" name="emergency_name" placeholder="Optional but recommended" />
              <Field label="Phone" name="emergency_phone" type="tel" placeholder="+65 …" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-6 py-3 font-semibold shadow-md active:scale-[0.98] transition-transform"
          >
            Done →
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-coral-600 ml-0.5">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow"
      />
    </label>
  );
}
