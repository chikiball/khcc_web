"use client";

import { useState, useTransition } from "react";
import { approveUser, rejectUser } from "@/app/admin/members/actions";

export function ApproveButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => approveUser(userId))}
      className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-4 py-2 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
    >
      {pending ? "…" : "Approve"}
    </button>
  );
}

export function RejectButton({
  userId,
  userName,
  variant = "reject",
}: {
  userId: string;
  userName: string;
  variant?: "reject" | "remove";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const isRemove = variant === "remove";
  const triggerLabel = isRemove ? "Remove" : "Reject";
  const confirmLabel = isRemove ? "Confirm remove" : "Confirm reject";
  const promptText = isRemove
    ? "Remove access for"
    : "Reject";
  const promptSuffix = isRemove
    ? "? They will lose access immediately and get an email with the reason."
    : "? They will get an email with the reason.";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-2xl bg-white ring-1 ring-maroon-300 text-ink hover:bg-cream-100 px-4 py-2 text-sm font-semibold active:scale-[0.98] transition-transform"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-maroon-50 ring-1 ring-maroon-200 p-3 mt-2 w-full">
      <p className="text-sm text-ink">
        {promptText} <span className="font-semibold">{userName}</span>
        {promptSuffix}
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Brief, kind."
        rows={2}
        autoFocus
        className="mt-2 w-full rounded-xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-maroon-500 px-3 py-2 text-sm outline-none"
      />
      <div className="mt-2 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          disabled={pending}
          className="px-3 py-2 text-sm text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              const fd = new FormData();
              fd.set("reason", reason.trim());
              await rejectUser(userId, fd);
            })
          }
          className="inline-flex items-center justify-center rounded-2xl bg-maroon-700 hover:bg-maroon-800 text-cream-50 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
