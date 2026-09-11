// The appearances (Brendan, 2026-09-07; renamed 2026-09-11). Two modes: Light
// Mode, the original white, and Dark Mode, the original palette. Two shades
// of them: Slate lifts the page a shade off white, Charcoal lifts it off pure
// black. Each is a class on <html>, set by next-themes; the palettes live in
// packages/ui/src/styles/globals.css. (Red State and Blue State were tried
// site-wide on 2026-09-11 and undone the same hour.)

export type ThemeName = "light" | "dark" | "light-2" | "dark-2"

export type ThemeGroup = "mode" | "shade"

export const THEMES: { value: ThemeName; label: string; group: ThemeGroup }[] = [
  { value: "light", label: "Light Mode", group: "mode" },
  { value: "dark", label: "Dark Mode", group: "mode" },
  { value: "light-2", label: "Slate", group: "shade" },
  { value: "dark-2", label: "Charcoal", group: "shade" },
]

export const THEME_NAMES: ThemeName[] = THEMES.map((t) => t.value)

export const isDark = (theme: string | undefined) => theme === "dark" || theme === "dark-2"

/** The other side of the same pair: Charcoal flips to Slate, Dark Mode to Light Mode. */
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
