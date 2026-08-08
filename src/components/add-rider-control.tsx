"use client";

import { useState, useTransition } from "react";
import { addRiderToPace } from "@/app/rides/actions";

type Member = { id: string; name: string | null };

/**
 * Manager-only control on a pace group: pick an approved member and add them
 * to this pace on their behalf. `members` is already filtered to riders not
 * yet in this pace. The added rider can remove themselves later via the normal
 * RSVP toggle.
 *
 * Also rendered on completed rides, where it means "record who actually rode"
 * rather than "sign someone up" — hence the `completed` label switch.
 */
export function AddRiderControl({
  rideId,
  paceGroupId,
  members,
  completed,
}: {
  rideId: string;
  paceGroupId: string;
  members: Member[];
  completed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!members.length) {
    return (
      <p className="text-xs text-ink-soft italic">All members are already in this pace.</p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-coral-700 hover:text-coral-800"
      >
        {completed ? "+ Add rider who rode" : "+ Add rider"}
      </button>
    );
  }

  // The action returns its failures instead of throwing — a throw from a
  // server action called inside startTransition has no boundary and blanks the
  // page with "Application error", losing the manager's selection.
  const handleAdd = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await addRiderToPace(rideId, paceGroupId, selected);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setSelected("");
      setOpen(false);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
          className="flex-1 min-w-[10rem] rounded-xl bg-white ring-1 ring-maroon-300 px-3 py-2 text-sm text-ink"
        >
          <option value="">Select a member…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? "Unnamed rider"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !selected}
          className="rounded-xl bg-coral-500 hover:bg-coral-600 text-cream-50 font-semibold px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelected("");
            setError(null);
          }}
          disabled={pending}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-xs text-flash-600 rounded-xl bg-flash-500/10 ring-1 ring-flash-500/40 px-3 py-2">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
