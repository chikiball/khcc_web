"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

export function EmailSignIn() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      await signIn("nodemailer", { email: email.trim(), redirect: false });
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-cream-100 ring-1 ring-coral-300 p-4 text-sm text-ink">
        <p className="font-semibold">Check your inbox.</p>
        <p className="text-ink-soft mt-1">
          We sent a sign-in link to <span className="text-ink">{email}</span>.
          The link is good for 24 hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="mt-3 text-xs text-coral-700 hover:text-coral-800 underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block">
        <span className="sr-only">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="w-full inline-flex items-center justify-center rounded-2xl bg-maroon-700 hover:bg-maroon-800 text-cream-50 px-6 py-3 font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
