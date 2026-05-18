"use client";

import { useState } from "react";
import { acceptTerms } from "./actions";

export function AcceptForm() {
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async () => {
        setPending(true);
        await acceptTerms();
      }}
      className="mt-8 space-y-4"
    >
      <label className="flex items-start gap-3 rounded-2xl bg-cream-100 ring-1 ring-maroon-200/60 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-5 accent-coral-500 shrink-0"
        />
        <span className="text-sm text-ink leading-relaxed">
          I have read and understood the KHCC member agreement above, and I
          accept it. I understand that road cycling carries risk and that I
          ride at my own risk.
        </span>
      </label>

      <button
        type="submit"
        disabled={!agreed || pending}
        className="w-full inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 disabled:bg-maroon-200 disabled:cursor-not-allowed text-cream-50 px-5 py-3 text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform"
      >
        {pending ? "Saving…" : "I accept — continue"}
      </button>
    </form>
  );
}
