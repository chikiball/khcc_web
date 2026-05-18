"use client";

import { useState, useTransition } from "react";
import { cancelPaceGroup } from "@/app/admin/rides/actions";
import type { RidePaceGroup } from "@/db/schema";

export function PaceCancelButtons({ paceGroups }: { paceGroups: RidePaceGroup[] }) {
  return (
    <ul className="space-y-2">
      {paceGroups.map((pg) => (
        <li key={pg.id} className="flex items-center gap-3 rounded-xl bg-white ring-1 ring-maroon-200/60 px-4 py-3">
          <span className="font-display font-bold text-lg text-ink w-6">{pg.paceCode}</span>
          <span className={`text-xs flex-1 ${pg.status === "cancelled" ? "line-through text-ink-soft/60" : "text-ink-soft"}`}>
            {pg.status === "cancelled" ? `Cancelled: ${pg.cancelledReason ?? ""}` : "Scheduled"}
          </span>
          {pg.status === "scheduled" && (
            <PaceCancelButton paceGroupId={pg.id} paceCode={pg.paceCode} />
          )}
        </li>
      ))}
    </ul>
  );
}

function PaceCancelButton({ paceGroupId, paceCode }: { paceGroupId: string; paceCode: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs text-maroon-700 hover:text-maroon-800 font-medium">
        Cancel {paceCode}
      </button>
    );
  }

  return (
    <div className="w-full mt-2 space-y-2">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason" rows={2} autoFocus
        className="w-full rounded-lg bg-cream-50 ring-1 ring-maroon-200 focus:ring-2 focus:ring-maroon-500 px-3 py-2 text-xs outline-none" />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => { setOpen(false); setReason(""); }}
          disabled={pending} className="text-xs text-ink-soft hover:text-ink px-2 py-1">Keep it</button>
        <button type="button" disabled={pending || !reason.trim()}
          onClick={() => startTransition(async () => {
            const fd = new FormData();
            fd.set("reason", reason.trim());
            await cancelPaceGroup(paceGroupId, fd);
          })}
          className="text-xs bg-maroon-700 hover:bg-maroon-800 text-cream-50 px-3 py-1 rounded-lg disabled:opacity-50">
          {pending ? "…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
