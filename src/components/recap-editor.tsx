"use client";

import { useState } from "react";
import { saveRecap } from "@/app/rides/actions";

export function RecapEditor({
  rideId,
  initialNote,
  authorName,
  authorAt,
}: {
  rideId: string;
  initialNote: string | null;
  authorName: string | null;
  authorAt: Date | null;
}) {
  const [editing, setEditing] = useState(!initialNote);
  const action = saveRecap.bind(null, rideId);

  if (!editing) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4 space-y-2">
        <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{initialNote}</p>
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span>
            {authorName && `— ${authorName}`}
            {authorAt && (
              <span className="opacity-60">
                {" · "}
                {authorAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-coral-700 hover:text-coral-800 font-medium"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4 space-y-2"
    >
      <textarea
        name="recap_note"
        defaultValue={initialNote ?? ""}
        rows={4}
        placeholder="How did it go? Anything to remember?"
        className="w-full rounded-xl bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-3 py-2 text-sm outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        {initialNote && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-4 py-2 text-sm font-semibold"
        >
          Save recap
        </button>
      </div>
    </form>
  );
}
