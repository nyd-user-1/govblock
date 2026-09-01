// The calendar pane's own chrome: a floating header the grids scroll under,
// plus (month view) the weekday bar. The month view docks its month labels
// on the header title, so the two share these numbers.
export const HEADER_PADDING = 8
export const HEADER_HEIGHT = 64
// Its bottom border is inside that height.
export const HEADER_BORDER = 1
export const HEADER_TOTAL = HEADER_PADDING + HEADER_HEIGHT
export const WEEKDAY_HEIGHT = 40
export const CHROME_HEIGHT = HEADER_TOTAL + WEEKDAY_HEIGHT
// Height of a month label; the docked label sits on the center of the title.
export const LABEL_HEIGHT = 32
export const DOCK_TOP =
  HEADER_PADDING + (HEADER_HEIGHT - HEADER_BORDER - LABEL_HEIGHT) / 2
