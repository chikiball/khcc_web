"use client";

import { useState } from "react";

/**
 * Copies a pre-formatted plain-text summary of a ride to the clipboard
 * for pasting into WhatsApp / SMS / email. The text is built server-side
 * (src/lib/share.ts → buildRideShareText) and passed in as a prop.
 *
 * Falls back to the legacy execCommand("copy") trick when the browser
 * doesn't expose the async clipboard API (older Safari, non-HTTPS).
 */
export function CopyRideButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="inline-flex items-center justify-center gap-2 rounded-2xl ring-1 ring-maroon-200 bg-white hover:bg-cream-100 text-ink px-4 py-2 text-sm font-medium active:scale-[0.98] transition-transform"
    >
      {copied ? "✓ Copied to clipboard" : "📋 Copy for WhatsApp"}
    </button>
  );
}
