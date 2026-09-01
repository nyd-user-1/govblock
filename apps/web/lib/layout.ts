// Ported from livingston-v3 lib/policy/layout.ts — the ⋮ → Size choices.
export const SIZE_LABEL = {
  kpi: "Tile (3×1)",
  split: "Split (3×1)",
  small: "Small (3×2)",
  medium: "Medium (4×2)",
  chart: "Chart (6×2)",
  tall: "Tall (4×3)",
  wide: "Wide (6×3)",
} as const

export type SizeName = keyof typeof SIZE_LABEL

export const SIZE_CHOICES: SizeName[] = ["kpi", "small", "medium", "chart", "tall", "wide"]
