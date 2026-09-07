// The four appearances (Brendan, 2026-09-07): two darks and two lights. Dark
// Mode 1 is the original palette; Dark Mode 2 lifts the page off pure black;
// Light Mode 1 is the original white; Light Mode 2 is Dark 2's rough mirror,
// the page a shade off white. Each is a class on <html>, set by next-themes;
// the palettes live in packages/ui/src/styles/globals.css.

export type ThemeName = "light" | "light-2" | "dark" | "dark-2"

export const THEMES: { value: ThemeName; label: string }[] = [
  { value: "light", label: "Light Mode 1" },
  { value: "light-2", label: "Light Mode 2" },
  { value: "dark", label: "Dark Mode 1 (Original)" },
  { value: "dark-2", label: "Dark Mode 2" },
]

export const THEME_NAMES: ThemeName[] = THEMES.map((t) => t.value)

export const isDark = (theme: string | undefined) => theme === "dark" || theme === "dark-2"

/** The other side of the same pair: Dark 2 flips to Light 2, Dark 1 to Light 1. */
export function flipTheme(theme: string | undefined): ThemeName {
  switch (theme) {
    case "dark":
      return "light"
    case "dark-2":
      return "light-2"
    case "light-2":
      return "dark-2"
    default:
      return "dark"
  }
}
