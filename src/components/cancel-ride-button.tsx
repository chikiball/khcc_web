"use client";

import { useState, useTransition } from "react";
import { cancelRide } from "@/app/admin/rides/actions";

export function CancelRideButton({ rideId, rideTitle }: { rideId: string; rideTitle: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    if (!reason.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reason", reason.trim());
      await cancelRide(rideId, fd);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-2xl bg-maroon-700 hover:bg-maroon-800 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        Cancel this ride
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-maroon-50 ring-1 ring-maroon-200 p-4">
      <p className="text-sm text-ink">
        Cancel <span className="font-semibold">{rideTitle}</span>? Members will see the reason on the ride page.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Weather / route change / leader unavailable …"
        rows={2}
        autoFocus
        className="mt-3 w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-maroon-500 px-3 py-2 text-sm outline-none"
      />
      <div className="mt-3 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          className="px-4 py-2 text-sm text-ink-soft hover:text-ink"
          disabled={pending}
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending || !reason.trim()}
          className="inline-flex items-center justify-center rounded-2xl bg-maroon-700 hover:bg-maroon-800 text-cream-50 px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Cancelling…" : "Confirm cancel"}
        </button>
      </div>
    </div>
  );
}
