import { colorClasses, type RideTypeOption } from "@/lib/ride-types";
import { LocationFields } from "@/components/location-fields";

type Ride = {
  title?: string | null;
  starts_at?: string | null;
  start_point_name?: string | null;
  start_point_lat?: string | null;
  start_point_lng?: string | null;
  distance_km?: string | null;
  elevation_m?: number | null;
  pace_group?: string | null;
  route_url?: string | null;
  description?: string | null;
  cap?: number | null;
  leader_id?: string | null;
};

export type LeaderOption = {
  id: string;
  name: string | null;
};

export function RideForm({
  action,
  defaultValues,
  leaders,
  rideTypes,
  submitLabel,
  readOnly,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: Ride;
  leaders: LeaderOption[];
  rideTypes: RideTypeOption[];
  submitLabel: string;
  readOnly?: boolean;
}) {
  const v = defaultValues ?? {};
  const activeTypes = rideTypes.filter((t) => t.active || v.pace_group === t.code);
  const defaultCode = v.pace_group ?? activeTypes[0]?.code ?? "";

  return (
    <form action={action} encType="multipart/form-data" className="mt-6 space-y-5">
      <Field
        label="Title"
        name="title"
        required
        defaultValue={v.title ?? ""}
        placeholder="Saturday Bunch — East Coast"
        readOnly={readOnly}
      />

      <Field
        label="Date & time"
        name="starts_at"
        type="datetime-local"
        required
        defaultValue={v.starts_at ?? ""}
        readOnly={readOnly}
      />

      <Field
        label="Start point"
        name="start_point_name"
        required
        defaultValue={v.start_point_name ?? ""}
        placeholder="Marina Barrage"
        readOnly={readOnly}
      />

      <LocationFields
        initialLat={v.start_point_lat ?? null}
        initialLng={v.start_point_lng ?? null}
        readOnly={readOnly}
      />

      <fieldset disabled={readOnly}>
        <legend className="text-sm font-medium text-ink">Pace group</legend>
        <p className="text-xs text-ink-soft mt-0.5 mb-2">
          Manage these in <span className="font-medium">Admin → Types</span>.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {activeTypes.map((t) => {
            const tone = colorClasses(t.color);
            return (
              <label
                key={t.code}
                className={`relative flex flex-col items-center justify-center rounded-2xl ring-1 ring-maroon-200 bg-white py-3 px-2 cursor-pointer has-[:checked]:${tone.bg.replace("/15", "/30")} has-[:checked]:${tone.text} has-[:checked]:${tone.ring} has-[:disabled]:opacity-50 transition-colors`}
                title={t.name}
              >
                <input
                  type="radio"
                  name="pace_group"
                  value={t.code}
                  defaultChecked={defaultCode === t.code}
                  required
                  disabled={readOnly}
                  className="sr-only"
                />
                <span className="font-display font-bold text-xl">{t.code}</span>
                <span className="text-[10px] mt-0.5 text-ink-soft truncate max-w-full">
                  {t.name}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Distance (km)"
          name="distance_km"
          type="number"
          step="0.1"
          defaultValue={v.distance_km ?? ""}
          placeholder="65"
          readOnly={readOnly}
        />
        <Field
          label="Elevation (m)"
          name="elevation_m"
          type="number"
          step="1"
          defaultValue={v.elevation_m ?? ""}
          placeholder="180"
          readOnly={readOnly}
        />
      </div>

      <Field
        label="Route URL (Strava, Komoot, etc.)"
        name="route_url"
        type="url"
        defaultValue={v.route_url ?? ""}
        placeholder="https://www.strava.com/routes/..."
        readOnly={readOnly}
      />

      {!readOnly && (
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1">
            GPX file (optional)
          </span>
          <input
            type="file"
            name="gpx"
            accept=".gpx,application/gpx+xml,application/xml"
            className="block w-full text-sm text-ink-soft file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cream-100 file:text-ink hover:file:bg-cream-200 file:cursor-pointer"
          />
          <p className="text-xs text-ink-soft mt-1">
            Replaces distance and elevation with values from the file. Strava
            → Export GPX, Komoot → Download GPX, Garmin Connect, etc.
          </p>
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1">Description</span>
        <textarea
          name="description"
          defaultValue={v.description ?? ""}
          placeholder="Steady B-pace loop. Coffee at the usual spot after."
          rows={3}
          readOnly={readOnly}
          className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow read-only:opacity-70"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Cap"
          name="cap"
          type="number"
          step="1"
          defaultValue={v.cap ?? ""}
          placeholder="Optional"
          readOnly={readOnly}
        />
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1">Leader</span>
          <select
            name="leader_id"
            defaultValue={v.leader_id ?? ""}
            disabled={readOnly}
            className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow disabled:opacity-70"
          >
            <option value="">Unassigned</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? "(unnamed)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!readOnly && (
        <button
          type="submit"
          className="w-full mt-2 inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-6 py-3 font-semibold shadow-md active:scale-[0.98] transition-transform"
        >
          {submitLabel}
        </button>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
  placeholder,
  type = "text",
  step,
  readOnly,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
  step?: string;
  readOnly?: boolean;
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
        step={step}
        readOnly={readOnly}
        className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow read-only:opacity-70"
      />
    </label>
  );
}
