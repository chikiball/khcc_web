/**
 * Theme registry. Admin can swap the live site theme at /admin/theme;
 * selection is persisted in content_blocks (key: "active_theme") and
 * applied as a `data-theme` attribute on <html>, which switches all of
 * Tailwind's --color-* design tokens via CSS variable overrides in
 * globals.css.
 *
 * To add a theme: append an entry below AND a corresponding
 * `[data-theme="<key>"] { ... }` block in src/app/globals.css.
 */

export type ThemeKey = "coral" | "bright" | "sky" | "mono";

export type ThemeOption = {
  key: ThemeKey;
  label: string;
  description: string;
  /** 5 swatches displayed on the picker tile, dominant → light. */
  swatches: string[];
};

export const THEMES: ThemeOption[] = [
  {
    key: "coral",
    label: "Coral",
    description: "Pink + maroon + cream. The original KHCC kit.",
    swatches: ["#ec6e8a", "#5b1f2a", "#ff5b3f", "#f4ece0", "#fdfaf5"],
  },
  {
    key: "bright",
    label: "Bright",
    description: "Magenta + teal + amber — the \"we went bright\" rainbow-swirl jersey.",
    swatches: ["#ec4899", "#115e59", "#f59e0b", "#fef3c7", "#fffbeb"],
  },
  {
    key: "sky",
    label: "Sky",
    description: "Sky blue + navy + coral accent — the blue training kit.",
    swatches: ["#0ea5e9", "#1e3a8a", "#ff5b3f", "#dbeafe", "#f0f9ff"],
  },
  {
    key: "mono",
    label: "Mono",
    description: "Slate + cream with a single red accent. Minimal, timeless.",
    swatches: ["#475569", "#0f172a", "#dc2626", "#e7e5e4", "#fafaf9"],
  },
];

export const DEFAULT_THEME: ThemeKey = "coral";

export const THEME_BLOCK_KEY = "active_theme";

export function isThemeKey(s: string): s is ThemeKey {
  return THEMES.some((t) => t.key === s);
}

export function themeByKey(key: string): ThemeOption {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
