"use client";

import { useState } from "react";
import { colorClasses, type RideTypeOption } from "@/lib/ride-types";
import type { PaceGroupInput } from "@/app/admin/rides/actions";

type Leader = { id: string; name: string | null };

type Props = {
  defaultPaceGroups: PaceGroupInput[];
  rideTypes: RideTypeOption[];
  leaders: Leader[];
  defaultDistanceKm?: string | null;
  defaultElevationM?: number | null;
};

export function PaceGroupsEditor({
  defaultPaceGroups,
  rideTypes,
  leaders,
  defaultDistanceKm,
  defaultElevationM,
}: Props) {
  const [groups, setGroups] = useState<PaceGroupInput[]>(
    defaultPaceGroups.length > 0 ? defaultPaceGroups : [blankGroup(rideTypes)],
  );

  const update = (i: number, patch: Partial<PaceGroupInput>) =>
    setGroups((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  const remove = (i: number) =>
    setGroups((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const add = () =>
    setGroups((prev) => [
      ...prev,
      { ...blankGroup(rideTypes), position: prev.length },
    ]);

  const activeTypes = rideTypes.filter((t) => t.active);
  const usedCodes = new Set(groups.map((g) => g.pace_code));

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ink">Pace groups</legend>
      <p className="text-xs text-ink-soft">
        Each pace group can have its own leader, cap, and optional distance/elevation
        override. Click + to add more paces.
      </p>

      {/* Hidden input carries the serialised array to the server action */}
      <input type="hidden" name="pace_groups" value={JSON.stringify(groups)} />

      {groups.map((g, i) => {
        const t = rideTypes.find((rt) => rt.code === g.pace_code);
        const tone = colorClasses(t?.color ?? "coral");
        const available = activeTypes.filter(
          (rt) => rt.code === g.pace_code || !usedCodes.has(rt.code),
        );

        return (
          <div
            key={i}
            className={`rounded-2xl ring-1 p-4 space-y-3 ${
              g.status === "cancelled"
                ? "bg-cream-100 ring-maroon-200/50 opacity-60"
                : "bg-white ring-maroon-200/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`hex-clip inline-flex items-center justify-center w-10 h-10 font-display font-bold text-base ring-1 shrink-0 ${tone.bg} ${tone.text} ${tone.ring}`}
              >
                {g.pace_code || "?"}
              </span>

              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-xs font-medium text-ink mb-1">Pace *</span>
                  <select
                    value={g.pace_code}
                    onChange={(e) => update(i, { pace_code: e.target.value })}
                    className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                  >
                    {available.map((rt) => (
                      <option key={rt.code} value={rt.code}>
                        {rt.code} — {rt.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-ink mb-1">Leader</span>
                  <select
                    value={g.leader_id ?? ""}
                    onChange={(e) => update(i, { leader_id: e.target.value || undefined })}
                    className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Unassigned</option>
                    {leaders.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name ?? "(unnamed)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-medium text-ink mb-1">Cap</span>
                  <input
                    type="number"
                    min="1"
                    value={g.cap ?? ""}
                    placeholder="No limit"
                    onChange={(e) => update(i, { cap: e.target.value || undefined })}
                    className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
                  />
                </label>
              </div>

              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 size-8 rounded-full flex items-center justify-center text-ink-soft hover:text-maroon-700 hover:bg-cream-100"
                  title="Remove this pace"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Optional overrides */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="block">
                <span className="block font-medium text-ink mb-1">
                  Distance km
                  <span className="text-ink-soft font-normal">
                    {" "}(default: {defaultDistanceKm ?? "—"})
                  </span>
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={g.distance_km ?? ""}
                  placeholder="Override"
                  onChange={(e) => update(i, { distance_km: e.target.value || undefined })}
                  className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 outline-none"
                />
              </label>
              <label className="block">
                <span className="block font-medium text-ink mb-1">
                  Elevation m
                  <span className="text-ink-soft font-normal">
                    {" "}(default: {defaultElevationM ?? "—"})
                  </span>
                </span>
                <input
                  type="number"
                  step="1"
                  value={g.elevation_m ?? ""}
                  placeholder="Override"
                  onChange={(e) => update(i, { elevation_m: e.target.value || undefined })}
                  className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 outline-none"
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="block font-medium text-ink mb-1">Pace-specific notes</span>
              <textarea
                rows={2}
                value={g.notes ?? ""}
                placeholder="e.g. A group turns back at the hill — B continues on flat loop"
                onChange={(e) => update(i, { notes: e.target.value || undefined })}
                className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 outline-none resize-none"
              />
            </label>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-coral-700 hover:text-coral-800"
      >
        + Add pace group
      </button>
    </fieldset>
  );
}

function blankGroup(types: RideTypeOption[]): PaceGroupInput {
  const first = types.find((t) => t.active) ?? types[0];
  return { pace_code: first?.code ?? "B", position: 0 };
}
