import Link from "next/link";
import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { asc, eq } from "drizzle-orm";
import { AvatarPicker } from "@/components/avatar-picker";
import { colorClasses } from "@/lib/ride-types";
import { signOut } from "@/app/auth/actions";
import { updateProfile } from "./actions";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireApproved();
  const { saved } = await searchParams;

  // Pull both public and private fields. requireApproved already gates,
  // and joining users_private here is the only path that exposes the
  // emergency contact data to the user themselves.
  const [profile] = await db
    .select({
      name: schema.users.name,
      email: schema.users.email,
      image: schema.users.image,
      paceGroup: schema.users.paceGroup,
      bike: schema.users.bike,
      stravaHandle: schema.users.stravaHandle,
      bio: schema.users.bio,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  const [priv] = await db
    .select({
      emergencyContactName: schema.usersPrivate.emergencyContactName,
      emergencyContactPhone: schema.usersPrivate.emergencyContactPhone,
    })
    .from(schema.usersPrivate)
    .where(eq(schema.usersPrivate.userId, user.id))
    .limit(1);

  const rideTypes = await db
    .select()
    .from(schema.rideTypes)
    .where(eq(schema.rideTypes.active, true))
    .orderBy(asc(schema.rideTypes.position));
  // Include the user's current type even if it has been deactivated, so
  // they can see what they are still labelled as until they pick a new one.
  if (
    profile?.paceGroup &&
    !rideTypes.some((t) => t.code === profile.paceGroup)
  ) {
    const [retired] = await db
      .select()
      .from(schema.rideTypes)
      .where(eq(schema.rideTypes.code, profile.paceGroup))
      .limit(1);
    if (retired) rideTypes.push(retired);
  }

  const initial = (profile?.name ?? user.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-maroon-200/40">
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink">
          ← Rides
        </Link>
        <form action={signOut}>
          <button className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </header>

      <div className="max-w-md mx-auto px-5 py-8">
        <h1 className="font-display text-3xl font-bold">Your profile</h1>
        <p className="text-sm text-ink-soft mt-1">
          Signed in as <span className="text-ink">{profile?.email ?? user.email}</span>
        </p>

        {saved && (
          <div className="mt-4 rounded-2xl bg-coral-100 ring-1 ring-coral-300 px-4 py-3 text-sm text-coral-800">
            ✓ Saved.
          </div>
        )}

        {/*
          Single form with multipart encoding so the avatar file rides
          along with the rest of the fields. Server action handles both
          atomically inside one DB transaction.
        */}
        <form action={updateProfile} encType="multipart/form-data" className="mt-8 space-y-5">
          <AvatarPicker
            currentImage={profile?.image ?? null}
            fallbackInitial={initial}
          />

          <Field
            label="Display name"
            name="name"
            required
            defaultValue={profile?.name ?? ""}
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
                    className={`relative flex flex-col items-center justify-center rounded-2xl ring-1 ring-maroon-200 bg-white py-3 cursor-pointer has-[:checked]:${tone.bg.replace("/15", "/30")} has-[:checked]:${tone.text} has-[:checked]:${tone.ring} transition-colors`}
                    title={t.name}
                  >
                    <input
                      type="radio"
                      name="pace_group"
                      value={t.code}
                      defaultChecked={(profile?.paceGroup ?? "B") === t.code}
                      className="sr-only"
                    />
                    <span className="font-display font-bold text-xl">{t.code}</span>
                    <span className="text-[10px] mt-0.5 text-ink-soft">{t.name}</span>
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
            placeholder="@khcc.rider — optional"
          />

          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1">Bio</span>
            <textarea
              name="bio"
              defaultValue={profile?.bio ?? ""}
              placeholder="Anything you want the bunch to know."
              rows={3}
              className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
            />
          </label>

          <div className="pt-3">
            <h2 className="text-sm font-semibold text-ink">Emergency contact</h2>
            <p className="text-xs text-ink-soft">
              Private. Only admins and the leader of a ride you&rsquo;ve RSVP&rsquo;d to can see this.
            </p>
            <div className="mt-3 space-y-3">
              <Field
                label="Name"
                name="emergency_name"
                defaultValue={priv?.emergencyContactName ?? ""}
                placeholder="Who do we call?"
              />
              <Field
                label="Phone"
                name="emergency_phone"
                type="tel"
                defaultValue={priv?.emergencyContactPhone ?? ""}
                placeholder="+65 …"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-6 py-3 font-semibold shadow-md active:scale-[0.98] transition-transform"
          >
            Save
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
        className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
      />
    </label>
  );
}
