"use client";

import { useTransition } from "react";
import { requestReapproval } from "@/app/pending/actions";

export function ReapplyButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => requestReapproval())}
      className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-5 py-2.5 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
    >
      {pending ? "Sending…" : "Request another review"}
    </button>
  );
}
