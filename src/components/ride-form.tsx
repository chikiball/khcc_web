import { LocationFields } from "@/components/location-fields";
import { PaceGroupsEditor } from "@/components/pace-groups-editor";
import { RouteSourcePicker, type LibraryRouteOption } from "@/components/route-source-picker";
import type { RideTypeOption } from "@/lib/ride-types";
import type { PaceGroupInput } from "@/app/admin/rides/actions";

export type LeaderOption = { id: string; name: string | null };

type Ride = {
  title?: string | null;
  starts_at?: string | null;
  start_point_name?: string | null;
  start_point_lat?: string | null;
  start_point_lng?: string | null;
  distance_km?: string | null;
  elevation_m?: number | null;
  route_url?: string | null;
  description?: string | null;
};

export function RideForm({
  action,
  defaultValues,
  defaultPaceGroups,
  leaders,
  rideTypes,
  libraryRoutes,
  submitLabel,
  readOnly,
  confirmRedate,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: Ride;
  defaultPaceGroups?: PaceGroupInput[];
  leaders: LeaderOption[];
  rideTypes: RideTypeOption[];
  libraryRoutes?: LibraryRouteOption[];
  submitLabel: string;
  readOnly?: boolean;
  /**
   * Render the "move it anyway" checkbox. Set only after `updateRide` blocked
   * a past → future re-date on a ride that still holds riders/photos/recap.
   */
  confirmRedate?: boolean;
}) {
  const v = defaultValues ?? {};

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

      {/* Ride-level defaults — individual paces can override these */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Distance km (default)"
          name="distance_km"
          type="number"
          step="0.1"
          defaultValue={v.distance_km ?? ""}
          placeholder="65"
          readOnly={readOnly}
        />
        <Field
          label="Elevation m (default)"
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
        <RouteSourcePicker libraryRoutes={libraryRoutes ?? []} />
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

      {/* Multi-pace editor */}
      {!readOnly ? (
        <PaceGroupsEditor
          defaultPaceGroups={defaultPaceGroups ?? []}
          rideTypes={rideTypes}
          leaders={leaders}
          defaultDistanceKm={v.distance_km}
          defaultElevationM={v.elevation_m}
        />
      ) : (
        <p className="text-sm text-ink-soft italic">
          Pace groups are shown on the ride detail page. Edit the ride to modify them.
        </p>
      )}

      {/* Recurring options — only on new-ride form (not edit) */}
      {!readOnly && !defaultValues?.title && (
        <fieldset>
          <legend className="text-sm font-medium text-ink">Repeats</legend>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {(["none", "weekly", "biweekly"] as const).map((val) => (
              <label key={val} className="inline-flex items-center gap-2 cursor-pointer">
                <input type="radio" name="recurrence" value={val} defaultChecked={val === "none"} className="accent-coral-500" />
                <span>{{ none: "No — one-off", weekly: "Every week", biweekly: "Every 2 weeks" }[val]}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Recurring rides materialise 4 weeks in advance. A weekly cron extends them automatically.
          </p>
        </fieldset>
      )}

      {!readOnly && confirmRedate && (
        <label className="flex items-start gap-3 rounded-2xl bg-flash-500/10 ring-1 ring-flash-500/40 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            name="confirm_redate"
            value="1"
            className="mt-0.5 accent-flash-500"
          />
          <span className="text-sm text-ink">
            <span className="font-semibold">Move this ride anyway.</span> Its existing
            riders, photos and recap stay attached and the old date disappears from
            Past rides. Only do this to correct a wrong date — to run the ride again,
            use <strong>Duplicate ride</strong> below.
          </span>
        </label>
      )}

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
  label, name, required, defaultValue, placeholder, type = "text", step, readOnly,
}: {
  label: string; name: string; required?: boolean; defaultValue?: string | number;
  placeholder?: string; type?: string; step?: string; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-coral-600 ml-0.5">*</span>}
      </span>
      <input
        name={name} type={type} required={required} defaultValue={defaultValue}
        placeholder={placeholder} step={step} readOnly={readOnly}
        className="w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none transition-shadow read-only:opacity-70"
      />
    </label>
  );
}
