/**
 * Theme registry. Admin can swap the live site theme at /admin/theme;
 * selection is persisted in content_blocks (key: "active_theme") and
 * applied as a `data-theme` attribute on <html>, which switches all of
 * Tailwind's --color-* design tokens via CSS variable overrides in
 * globals.css.
 *
 * Default ("tropical") lives in the @theme block in globals.css; the
 * three keys below have explicit `[data-theme="<key>"]` overrides.
 *
 * To add a theme: append an entry below AND a corresponding
 * `[data-theme="<key>"] { ... }` block in src/app/globals.css.
 */

export type ThemeKey = "tropical" | "sunrise" | "lagoon" | "mono";

export type ThemeOption = {
  key: ThemeKey;
  label: string;
  description: string;
  /** 5 swatches displayed on the picker tile, dominant → light. */
  swatches: string[];
};

export const THEMES: ThemeOption[] = [
  {
    key: "tropical",
    label: "Tropical",
    description: "Sky blue + white + pale green. East Coast at sunrise.",
    swatches: ["#0ea5e9", "#1e293b", "#fb923c", "#ecfdf3", "#ffffff"],
  },
  {
    key: "sunrise",
    label: "Sunrise",
    description: "Warm orange + sand + cream. ECP first light.",
    swatches: ["#f97316", "#292524", "#ec4899", "#fdf3d8", "#fffdf7"],
  },
  {
    key: "lagoon",
    label: "Lagoon",
    description: "Teal + ocean blue + seafoam. Singapore Strait water.",
    swatches: ["#14b8a6", "#0c4a6e", "#f43f5e", "#d1fae5", "#f7fefb"],
  },
  {
    key: "mono",
    label: "Mono",
    description: "Slate + cream with a single red accent. Minimal, timeless.",
    swatches: ["#475569", "#0f172a", "#dc2626", "#e7e5e4", "#fafaf9"],
  },
];

export const DEFAULT_THEME: ThemeKey = "tropical";

export const THEME_BLOCK_KEY = "active_theme";

export function isThemeKey(s: string): s is ThemeKey {
  return THEMES.some((t) => t.key === s);
}

export function themeByKey(key: string): ThemeOption {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
