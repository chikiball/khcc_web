type Ride = {
  title?: string | null;
  starts_at?: string | null;
  start_point_name?: string | null;
  start_point_lat?: string | null;
  start_point_lng?: string | null;
  distance_km?: string | null;
  elevation_m?: number | null;
  pace_group?: "A" | "B" | "C" | null;
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
  submitLabel,
  readOnly,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: Ride;
  leaders: LeaderOption[];
  submitLabel: string;
  readOnly?: boolean;
}) {
  const v = defaultValues ?? {};

  return (
    <form action={action} className="mt-6 space-y-5">
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

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Latitude"
          name="start_point_lat"
          defaultValue={v.start_point_lat ?? ""}
          placeholder="1.2806"
          readOnly={readOnly}
        />
        <Field
          label="Longitude"
          name="start_point_lng"
          defaultValue={v.start_point_lng ?? ""}
          placeholder="103.8714"
          readOnly={readOnly}
        />
      </div>

      <fieldset disabled={readOnly}>
        <legend className="text-sm font-medium text-ink">Pace group</legend>
        <p className="text-xs text-ink-soft mt-0.5 mb-2">
          A — climbers · B — steady bunch · C — no-drop
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["A", "B", "C"] as const).map((p) => (
            <label
              key={p}
              className="relative flex items-center justify-center rounded-2xl ring-1 ring-maroon-200 bg-white py-3 cursor-pointer has-[:checked]:bg-coral-500 has-[:checked]:text-cream-50 has-[:checked]:ring-coral-600 has-[:disabled]:opacity-50 transition-colors"
            >
              <input
                type="radio"
                name="pace_group"
                value={p}
                defaultChecked={(v.pace_group ?? "B") === p}
                required
                disabled={readOnly}
                className="sr-only"
              />
              <span className="font-display font-bold text-xl">{p}</span>
            </label>
          ))}
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
        label="Route URL"
        name="route_url"
        type="url"
        defaultValue={v.route_url ?? ""}
        placeholder="https://www.strava.com/routes/..."
        readOnly={readOnly}
      />

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
