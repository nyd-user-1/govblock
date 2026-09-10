// What the map can draw, as a set the reader composes (Brendan, 2026-09-09:
// "an overlay view via a multi-select"). Two kinds: a fill over the
// congressional districts keyed to a reading, and a boundary drawn as a
// line so it can sit over any fill. Scope is who may switch it on: Congress
// is open; a state's own districts are the state's reader's; later, paid.
//
// The state entries are not written here. They are generated from the files
// under /geo by scripts/geo/state-districts.mjs, so putting a state's
// districts on the map is a fetch, not an edit.

import {
  RANK_COLOR,
  STATE_DISTRICTS,
  type StateOverlayId,
} from "@/lib/map/state-districts"

export type CoreOverlayId =
  | "party"
  | "delegation"
  | "money"
  | "heat"
  | "population"
  | "income"
  | "counties"
  | "zips"

export type OverlayId = CoreOverlayId | StateOverlayId

export const OVERLAY_GROUPS = [
  "Congress",
  "Boundaries",
  "State districts",
] as const
export type OverlayGroup = (typeof OVERLAY_GROUPS)[number]

export type Overlay = {
  id: OverlayId
  label: string
  kind: "fill" | "line"
  group: OverlayGroup
  scope: "public" | "state"
  /** The line's colour, for the map and its legend. */
  color?: string
  /** Whose districts, and which body — set on the state entries only. */
  state?: string
  chamber?: string
  /** How many districts the file holds. */
  count?: number
}

const CORE: Overlay[] = [
  {
    id: "party",
    label: "Party",
    kind: "fill",
    group: "Congress",
    scope: "public",
  },
  {
    id: "delegation",
    label: "Delegation split",
    kind: "fill",
    group: "Congress",
    scope: "public",
  },
  {
    id: "money",
    label: "Money raised",
    kind: "fill",
    group: "Congress",
    scope: "public",
  },
  {
    id: "heat",
    label: "Subject heat",
    kind: "fill",
    group: "Congress",
    scope: "public",
  },
  {
    id: "population",
    label: "Population",
    kind: "fill",
    group: "Congress",
    scope: "public",
  },
  {
    id: "income",
    label: "Median income",
    kind: "fill",
    group: "Congress",
    scope: "public",
  },
  {
    id: "counties",
    label: "Counties",
    // A wash, not a line: 3,235 hairline outlines read as noise, and Solar's
    // regions are legible because each is its own colour (Brendan, 2026-09-10).
    kind: "fill",
    group: "Boundaries",
    scope: "public",
  },
  {
    id: "zips",
    label: "ZIP codes",
    kind: "fill",
    group: "Boundaries",
    scope: "public",
  },
]

const STATES: Overlay[] = STATE_DISTRICTS.flatMap((entry) =>
  entry.chambers.map(
    (chamber): Overlay => ({
      id: chamber.id,
      label: `${chamber.chamber} districts`,
      kind: "line",
      group: "State districts",
      scope: "state",
      color: RANK_COLOR[chamber.rank],
      state: entry.code,
      chamber: chamber.chamber,
      count: chamber.count,
    })
  )
)

export const OVERLAYS: Overlay[] = [...CORE, ...STATES]

const BY_ID = new Map(OVERLAYS.map((o) => [o.id as string, o]))

export const overlay = (id: OverlayId) => BY_ID.get(id)!

/** A state's chamber, as an overlay — nothing if its file was never fetched. */
export const overlayFor = (state: string, chamber: string): Overlay | null =>
  STATES.find((o) => o.state === state && o.chamber === chamber) ?? null

/** The state entries, for the picker and the rail. */
export const stateOverlays = (state: string) =>
  STATES.filter((o) => o.state === state)

export const isStateOverlay = (id: OverlayId): id is StateOverlayId =>
  !!overlay(id)?.state

/** ZIP codes come by viewport from the Census, since the country's 33,000 do not fit in one file. */
export const ZCTA_QUERY = (bbox: [number, number, number, number]) =>
  `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query?geometry=${bbox.join(",")}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=GEOID,NAME&returnGeometry=true&outSR=4326&maxAllowableOffset=0.0015&resultRecordCount=2000&f=geojson`
/** Below this zoom a ZIP layer is a smear; the legend says so instead. */
export const ZCTA_MIN_ZOOM = 7
