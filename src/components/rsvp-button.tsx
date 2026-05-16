"use client";

import { useTransition } from "react";
import { toggleRsvp } from "@/app/rides/actions";

export function RsvpButton({
  rideId,
  isIn,
  size = "lg",
}: {
  rideId: string;
  isIn: boolean;
  size?: "sm" | "lg";
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await toggleRsvp(rideId, isIn);
    });
  };

  const base =
    "inline-flex items-center justify-center font-semibold rounded-2xl active:scale-[0.97] transition-all disabled:opacity-50 shadow-sm";
  const sizing =
    size === "lg" ? "px-6 py-3 text-base min-w-[8rem]" : "px-4 py-2 text-sm min-w-[5rem]";
  const variant = isIn
    ? "bg-cream-100 text-ink ring-1 ring-maroon-300 hover:bg-cream-200"
    : "bg-coral-500 hover:bg-coral-600 text-cream-50";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`${base} ${sizing} ${variant}`}
      aria-pressed={isIn}
    >
      {pending ? "…" : isIn ? "✓ In" : "I'm in"}
    </button>
  );
}
