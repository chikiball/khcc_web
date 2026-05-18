"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type MenuLink = { href: string; label: string };

/**
 * Mobile-only hamburger menu for the admin nav. Native <details> closes
 * only on summary-click; we want a tap-outside-to-close UX, plus Escape
 * key dismissal, so this is a small client component instead.
 */
export function AdminMobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (target && ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="sm:hidden relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Admin menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="cursor-pointer rounded-xl ring-1 ring-maroon-200 bg-white px-3 py-2 text-ink-soft hover:text-ink select-none"
      >
        <span className="block w-5 h-0.5 bg-current mb-1" />
        <span className="block w-5 h-0.5 bg-current mb-1" />
        <span className="block w-5 h-0.5 bg-current" />
      </button>

      {open && (
        <nav
          role="menu"
          className="absolute right-0 top-full mt-2 z-20 min-w-[10rem] rounded-2xl bg-white ring-1 ring-maroon-200 shadow-lg p-1 text-sm"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-xl text-ink hover:bg-cream-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
