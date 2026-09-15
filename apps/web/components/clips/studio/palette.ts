// Studio's colours and faces (2026-09-14): the customizer's own lists from
// lib/create/preset.ts — Base Color, Theme, Chart Color, Radius — and the
// site's fonts, as values a video can paint. Base sets the page and the text,
// light or dark; Theme is the accent; Chart is the pair a tally or a bar
// splits into. Hex from Tailwind's palettes, the ones those names come from.

export type Mode = "dark" | "light"

export const BASES: Record<string, { label: string; dark: { background: string; ink: string; muted: string }; light: { background: string; ink: string; muted: string } }> = {
  neutral: { label: "Neutral", dark: { background: "#0a0a0a", ink: "#fafafa", muted: "#262626" }, light: { background: "#ffffff", ink: "#0a0a0a", muted: "#e5e5e5" } },
  zinc: { label: "Zinc", dark: { background: "#09090b", ink: "#fafafa", muted: "#27272a" }, light: { background: "#ffffff", ink: "#09090b", muted: "#e4e4e7" } },
  stone: { label: "Stone", dark: { background: "#0c0a09", ink: "#fafaf9", muted: "#292524" }, light: { background: "#fafaf9", ink: "#0c0a09", muted: "#e7e5e4" } },
  mauve: { label: "Mauve", dark: { background: "#121113", ink: "#eeeef0", muted: "#2b292d" }, light: { background: "#fdfcfd", ink: "#211f26", muted: "#e9e8ea" } },
  olive: { label: "Olive", dark: { background: "#111210", ink: "#eceeec", muted: "#282a27" }, light: { background: "#fcfdfc", ink: "#1d211c", muted: "#e6e7e4" } },
  mist: { label: "Mist", dark: { background: "#0e1113", ink: "#eceff1", muted: "#262b2e" }, light: { background: "#fbfdfd", ink: "#1a2226", muted: "#e3e8ea" } },
  taupe: { label: "Taupe", dark: { background: "#12110f", ink: "#eeece9", muted: "#2b2825" }, light: { background: "#fdfcfb", ink: "#221f1b", muted: "#e9e6e2" } },
}

export const THEMES: Record<string, { label: string; dark: string; light: string }> = {
  neutral: { label: "Neutral", dark: "#e5e5e5", light: "#171717" },
  blue: { label: "Blue", dark: "#60a5fa", light: "#2563eb" },
  green: { label: "Green", dark: "#4ade80", light: "#16a34a" },
  orange: { label: "Orange", dark: "#fb923c", light: "#ea580c" },
  red: { label: "Red", dark: "#f87171", light: "#dc2626" },
  rose: { label: "Rose", dark: "#fb7185", light: "#e11d48" },
  violet: { label: "Violet", dark: "#a78bfa", light: "#7c3aed" },
  yellow: { label: "Yellow", dark: "#facc15", light: "#ca8a04" },
}

/** Yes and no: a tally's two sides, a bar's two parts. */
export const CHARTS: Record<string, { label: string; yes: string; no: string }> = {
  vote: { label: "Vote", yes: "#22c55e", no: "#ef4444" },
  party: { label: "Party", yes: "#3b82f6", no: "#ef4444" },
  neutral: { label: "Neutral", yes: "#d4d4d4", no: "#737373" },
  blue: { label: "Blue", yes: "#3b82f6", no: "#93c5fd" },
  green: { label: "Green", yes: "#22c55e", no: "#86efac" },
  orange: { label: "Orange", yes: "#f97316", no: "#fdba74" },
  red: { label: "Red", yes: "#ef4444", no: "#fca5a5" },
  violet: { label: "Violet", yes: "#8b5cf6", no: "#c4b5fd" },
}

export const RADII: Record<string, { label: string; px: number }> = {
  none: { label: "None", px: 0 },
  small: { label: "Small", px: 4 },
  medium: { label: "Default", px: 10 },
  large: { label: "Large", px: 22 },
}

export const MOTIONS: Record<string, string> = { fade: "Fade", slide: "Slide up", zoom: "Zoom", none: "Cut" }

export const PACES: Record<string, { label: string; factor: number }> = {
  relaxed: { label: "Relaxed", factor: 1.35 },
  default: { label: "Default", factor: 1 },
  brisk: { label: "Brisk", factor: 0.7 },
}

/** The site's faces; `var` is the loaded preview variable, the family the fallback (app/preview/fonts.ts). */
export const FACES: Record<string, { label: string; css: string }> = {
  geist: { label: "Geist", css: "var(--font-geist-sans), var(--font-sans), Geist, system-ui, sans-serif" },
  inter: { label: "Inter", css: "var(--font-inter), Inter, system-ui, sans-serif" },
  "dm-sans": { label: "DM Sans", css: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif" },
  "space-grotesk": { label: "Space Grotesk", css: "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif" },
  montserrat: { label: "Montserrat", css: "var(--font-montserrat), Montserrat, system-ui, sans-serif" },
  "ibm-plex-sans": { label: "IBM Plex Sans", css: "var(--font-ibm-plex-sans), 'IBM Plex Sans', system-ui, sans-serif" },
  oxanium: { label: "Oxanium", css: "var(--font-oxanium), Oxanium, system-ui, sans-serif" },
  merriweather: { label: "Merriweather", css: "var(--font-merriweather), Merriweather, Georgia, serif" },
  lora: { label: "Lora", css: "var(--font-lora), Lora, Georgia, serif" },
  "playfair-display": { label: "Playfair Display", css: "var(--font-playfair-display), 'Playfair Display', Georgia, serif" },
  "instrument-serif": { label: "Instrument Serif", css: "var(--font-instrument-serif), 'Instrument Serif', Georgia, serif" },
  "jetbrains-mono": { label: "JetBrains Mono", css: "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace" },
  "geist-mono": { label: "Geist Mono", css: "var(--font-geist-mono), var(--font-mono), 'Geist Mono', ui-monospace, monospace" },
}

export type Look = { mode: Mode; base: string; theme: string; chart: string; heading: string; font: string; radius: string; motion: string; pace: string }

export const DEFAULT_LOOK: Look = { mode: "dark", base: "neutral", theme: "blue", chart: "vote", heading: "geist", font: "geist", radius: "medium", motion: "fade", pace: "default" }

export type Paint = { background: string; ink: string; muted: string; accent: string; yes: string; no: string; radius: number; heading: string; font: string }

export function paint(look: Partial<Look> | undefined): Paint {
  const l = { ...DEFAULT_LOOK, ...(look ?? {}) }
  const base = (BASES[l.base] ?? BASES.neutral)[l.mode === "light" ? "light" : "dark"]
  const theme = THEMES[l.theme] ?? THEMES.blue
  const chart = CHARTS[l.chart] ?? CHARTS.vote
  return {
    ...base,
    accent: l.mode === "light" ? theme.light : theme.dark,
    yes: chart.yes,
    no: chart.no,
    radius: (RADII[l.radius] ?? RADII.medium).px,
    heading: (FACES[l.heading] ?? FACES.geist).css,
    font: (FACES[l.font] ?? FACES.geist).css,
  }
}
