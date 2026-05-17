/**
 * Color presets for ride_types.color. Storing the preset key (not raw hex)
 * keeps the design consistent and lets us audit the palette at compile
 * time. Tailwind needs literal class strings to ship them, so the COLORS
 * map below is the single source of truth — adding a new preset means
 * editing this file (and the admin form picker reads from here).
 */

export type ColorKey = "coral" | "maroon" | "flash" | "emerald" | "sky" | "amber";

export const COLOR_KEYS: ColorKey[] = ["coral", "maroon", "flash", "emerald", "sky", "amber"];

export const COLORS: Record<
  ColorKey,
  { label: string; bg: string; text: string; ring: string; swatch: string }
> = {
  coral: {
    label: "Coral",
    bg: "bg-coral-400/15",
    text: "text-coral-700",
    ring: "ring-coral-400/30",
    swatch: "bg-coral-500",
  },
  maroon: {
    label: "Maroon",
    bg: "bg-maroon-700/15",
    text: "text-maroon-700",
    ring: "ring-maroon-700/30",
    swatch: "bg-maroon-700",
  },
  flash: {
    label: "Flash",
    bg: "bg-flash-500/15",
    text: "text-flash-600",
    ring: "ring-flash-500/30",
    swatch: "bg-flash-500",
  },
  emerald: {
    label: "Emerald",
    bg: "bg-emerald-500/15",
    text: "text-emerald-700",
    ring: "ring-emerald-500/30",
    swatch: "bg-emerald-500",
  },
  sky: {
    label: "Sky",
    bg: "bg-sky-500/15",
    text: "text-sky-700",
    ring: "ring-sky-500/30",
    swatch: "bg-sky-500",
  },
  amber: {
    label: "Amber",
    bg: "bg-amber-500/15",
    text: "text-amber-700",
    ring: "ring-amber-500/30",
    swatch: "bg-amber-500",
  },
};

export function colorClasses(color: string) {
  return COLORS[(COLOR_KEYS.includes(color as ColorKey) ? color : "coral") as ColorKey];
}

export type RideTypeOption = {
  code: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  active: boolean;
};
