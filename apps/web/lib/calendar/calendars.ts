import type { CalendarColor } from "./types"

// Static class maps so Tailwind sees the full class names at build time.
// `data-active` is the hover shade held: a chip wears it while its popover is
// open and while it is being dragged.
export const eventBlockClasses: Record<CalendarColor, string> = {
  blue: "bg-blue-500/15 hover:bg-blue-500/25 data-active:bg-blue-500/25 text-blue-700 dark:text-blue-300 border-blue-500",
  green:
    "bg-green-500/15 hover:bg-green-500/25 data-active:bg-green-500/25 text-green-700 dark:text-green-300 border-green-500",
  amber:
    "bg-amber-500/15 hover:bg-amber-500/25 data-active:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500",
  red: "bg-red-500/15 hover:bg-red-500/25 data-active:bg-red-500/25 text-red-700 dark:text-red-300 border-red-500",
  violet:
    "bg-violet-500/15 hover:bg-violet-500/25 data-active:bg-violet-500/25 text-violet-700 dark:text-violet-300 border-violet-500",
}

// The phone month cell has no room for a dot and a time, so below `lg` a
// timed chip becomes a tinted pill: the calendar color carried by the fill.
export const eventChipCompactClasses: Record<CalendarColor, string> = {
  blue: "max-lg:bg-blue-500/15 max-lg:text-blue-700 dark:max-lg:text-blue-300",
  green:
    "max-lg:bg-green-500/15 max-lg:text-green-700 dark:max-lg:text-green-300",
  amber:
    "max-lg:bg-amber-500/15 max-lg:text-amber-700 dark:max-lg:text-amber-300",
  red: "max-lg:bg-red-500/15 max-lg:text-red-700 dark:max-lg:text-red-300",
  violet:
    "max-lg:bg-violet-500/15 max-lg:text-violet-700 dark:max-lg:text-violet-300",
}

export const calendarDotClasses: Record<CalendarColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
}

export const calendarCheckboxClasses: Record<CalendarColor, string> = {
  blue: "data-checked:border-blue-500 data-checked:bg-blue-500",
  green: "data-checked:border-green-500 data-checked:bg-green-500",
  amber: "data-checked:border-amber-500 data-checked:bg-amber-500",
  red: "data-checked:border-red-500 data-checked:bg-red-500",
  violet: "data-checked:border-violet-500 data-checked:bg-violet-500",
}

export const eventOutlineClasses: Record<CalendarColor, string> = {
  blue: "outline-blue-500/25",
  green: "outline-green-500/25",
  amber: "outline-amber-500/25",
  red: "outline-red-500/25",
  violet: "outline-violet-500/25",
}
