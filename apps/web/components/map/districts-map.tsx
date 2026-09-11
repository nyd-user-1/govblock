"use client"

import * as React from "react"
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

import { geoUrl } from "@/lib/map/geo-url"
import { BASEMAP_STYLE } from "@/lib/map/basemap"
import {
  keyColor,
  LAYER,
  RAMP,
  PARTY_COLORS,
  MONEY_RAMP,
  HEAT_RAMP,
  SPLIT_RAMP,
  NO_DATA,
} from "@/lib/map/palette"
import type { Bounds } from "@/lib/map/bounds"
import { ZCTA_MIN_ZOOM, ZCTA_QUERY, type OverlayId } from "@/lib/map/overlays"
import { MapLegend } from "@/components/map/map-legend"
import type { ChamberDistricts } from "@/components/map/use-state-districts"

// The 119th Congress's districts on MapLibre (2026-09-09): the Census's own
// generalized boundaries served from /geo; whichever fills the reader has on
// stacked over them — the member's party, the population, the median income
// — the boundaries they asked for drawn over that as lines; the hovered
// district lifted; the state in focus and the chosen district each at one
// pixel. ZIP codes come by viewport, since the whole country's do not fit.
//
// A state's own legislative districts come the same way, one file per
// chamber, and answer the pointer as the congressional ones do: a chamber's
// districts and a congressional district cover the same ground, so what the
// pointer holds carries the chamber it belongs to and nothing else lights up.

export type { Bounds }

export type DistrictProps = {
  geoid: string
  state: string
  district: string
  name: string
  /** Set on a state's legislative districts; absent on congressional ones. */
  chamber?: string
}
export type Acs = Record<
  string,
  { name: string; population: number | null; medianIncome: number | null }
>
export type Party = Record<
  string,
  { party: string | null; name: string | null; people_id: number | null }
>
export type Metric = "party" | "population" | "income" | "money" | "heat"
export type Money = Record<string, number>
export type Heat = {
  areas: string[]
  districts: Record<string, Record<string, number>>
}

const FILL_ID = "cd-fill"

// The palette lives in lib/map/palette.ts; re-exported here because the
// panel, the legend and the card all read it through this module.
export {
  RAMP,
  PARTY_COLORS,
  MONEY_RAMP,
  HEAT_RAMP,
  SPLIT_RAMP,
} from "@/lib/map/palette"
const NONE = NO_DATA

/** The same district, in the same body — geoids repeat across chambers. */
export const sameDistrict = (
  a: DistrictProps | null,
  b: DistrictProps | null
) => !!a && !!b && a.geoid === b.geoid && a.chamber === b.chamber

/** Five steps a set of values climbs, at its own quintiles. */
export function quintiles(values: number[]) {
  const v = values
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  if (!v.length) return [0, 1, 2, 3, 4]
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  return [q(0), q(0.2), q(0.4), q(0.6), q(0.8)]
}

export function moneyStops(money: Money) {
  return quintiles(Object.values(money))
}
export function heatStops(heat: Heat, area: string) {
  return quintiles(Object.values(heat.districts).map((d) => d[area] ?? 0))
}

export function rampStops(metric: "population" | "income", acs: Acs) {
  const values = Object.values(acs)
    .map((d) => (metric === "population" ? d.population : d.medianIncome))
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b)
  if (!values.length) return [0, 1, 2, 3, 4]
  const q = (p: number) =>
    values[Math.min(values.length - 1, Math.floor(p * values.length))]
  return [q(0), q(0.2), q(0.4), q(0.6), q(0.8)]
}

/**
 * A file, fetched once, with a colour written onto every feature — the wash
 * Solar reads its regions by. MapLibre has no way to call a function for a
 * colour, so the colour has to be a property before it is a paint.
 */
function useWashed(
  path: string | null,
  key: (p: Record<string, unknown>) => string
) {
  const [fc, setFc] = React.useState<GeoJSON.FeatureCollection | null>(null)
  React.useEffect(() => {
    if (!path) return
    let live = true
    fetch(geoUrl(path))
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((j) => live && setFc(wash(j, key)))
      .catch(() => {})
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  return fc
}

function wash(
  fc: GeoJSON.FeatureCollection,
  key: (p: Record<string, unknown>) => string
): GeoJSON.FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        color: keyColor(key((f.properties ?? {}) as Record<string, unknown>)),
      },
    })),
  }
}

function useViewportZctas(
  on: boolean,
  ref: React.RefObject<MapRef | null>,
  tick: number,
  zoom: number
) {
  const [fc, setFc] = React.useState<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  })
  React.useEffect(() => {
    if (!on || zoom < ZCTA_MIN_ZOOM || !ref.current) return
    const b = ref.current.getBounds()
    const bbox: Bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    let live = true
    fetch(ZCTA_QUERY(bbox))
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then(
        (j) =>
          live &&
          j.features &&
          setFc(wash(j, (p) => String(p.GEOID ?? p.NAME ?? "")))
      )
      .catch(() => {})
    return () => {
      live = false
    }
  }, [on, tick, zoom, ref])
  return fc
}

export function DistrictsMap({
  overlays,
  money,
  heat,
  heatArea,
  onHeatArea,
  delegation,
  chambers,
  acs,
  party,
  selected,
  focusState,
  onSelect,
  onPoint,
  onHover,
  flyTo,
}: {
  overlays: Set<OverlayId>
  /** The state chambers switched on, already loaded. */
  chambers: ChamberDistricts[]
  acs: Acs
  party: Party
  money: Money
  heat: Heat
  /** Which policy area the heat is of. */
  heatArea: string
  onHeatArea: (area: string) => void
  /** A state's House delegation, from -1 solidly Republican to 1 solidly Democrat. */
  delegation: Record<string, number>
  selected: DistrictProps | null
  /** The state in focus, by FIPS: outlined at one pixel. */
  focusState: string | null
  onSelect: (district: DistrictProps | null) => void
  /** Where the click landed, for the join. */
  onPoint?: (point: [number, number]) => void
  onHover: (props: DistrictProps | null) => void
  flyTo?: Bounds | null
}) {
  const ref = React.useRef<MapRef>(null)
  const [hovered, setHovered] = React.useState<DistrictProps | null>(null)
  const [zoom, setZoom] = React.useState(3.4)
  const [moved, setMoved] = React.useState(0)

  const [data, setData] = React.useState<GeoJSON.FeatureCollection | null>(null)
  React.useEffect(() => {
    let live = true
    fetch(geoUrl("/geo/cd119.geojson"))
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((fc) => live && setData(fc))
      .catch(() => live && setData({ type: "FeatureCollection", features: [] }))
    return () => {
      live = false
    }
  }, [])
  // The readings ride on each feature as properties, so a fill expression
  // is a plain lookup rather than a 441-entry match in the style.
  const joined = React.useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!data) return null
    return {
      ...data,
      features: data.features.map((f) => {
        const p = f.properties as DistrictProps
        const row = acs[p.geoid]
        return {
          ...f,
          properties: {
            ...p,
            population: row?.population ?? null,
            income: row?.medianIncome ?? null,
            party: party[p.geoid]?.party ?? null,
            money: money[p.geoid] ?? null,
            heat: heat.districts[p.geoid]?.[heatArea] ?? null,
          },
        }
      }),
    }
  }, [data, acs, party, money, heat, heatArea])

  React.useEffect(() => {
    if (flyTo && ref.current)
      ref.current.fitBounds(
        [
          [flyTo[0], flyTo[1]],
          [flyTo[2], flyTo[3]],
        ],
        { padding: 40, duration: 900 }
      )
  }, [flyTo])

  const counties = useWashed(
    overlays.has("counties") ? "/geo/counties.geojson" : null,
    (p) => String(p.geoid ?? "")
  )
  const zctas = useViewportZctas(overlays.has("zips"), ref, moved, zoom)

  // The states file is here for the focus outline anyway; when the
  // delegation is drawn it carries each state's balance and its colour.
  const [statesFc, setStatesFc] =
    React.useState<GeoJSON.FeatureCollection | null>(null)
  React.useEffect(() => {
    let live = true
    fetch(geoUrl("/geo/states.geojson"))
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((fc) => live && setStatesFc(fc))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  const statesJoined = React.useMemo(() => {
    if (!statesFc) return null
    return {
      ...statesFc,
      features: statesFc.features.map((f) => {
        const fips = String((f.properties as { fips?: string })?.fips ?? "")
        const score = delegation[fips]
        // -1 is every seat Republican, 1 every seat Democrat; the middle is a split.
        const step =
          score == null ? -1 : Math.min(4, Math.floor(((score + 1) / 2) * 5))
        return {
          ...f,
          properties: {
            ...f.properties,
            split: score ?? null,
            splitColor: step < 0 ? NO_DATA : SPLIT_RAMP[step],
          },
        }
      }),
    }
  }, [statesFc, delegation])

  const onMove = (e: MapLayerMouseEvent) => {
    const p = (e.features?.[0]?.properties ?? null) as DistrictProps | null
    setHovered(p)
    onHover(p)
  }

  const fills = (
    ["party", "money", "heat", "population", "income"] as const
  ).filter((m) => overlays.has(m))
  const fillFor = (m: Metric) => {
    if (m === "party")
      return [
        "match",
        ["get", "party"],
        "D",
        PARTY_COLORS.D,
        "R",
        PARTY_COLORS.R,
        "I",
        PARTY_COLORS.I,
        NONE,
      ]
    const ramp = m === "money" ? MONEY_RAMP : m === "heat" ? HEAT_RAMP : RAMP
    const b =
      m === "money"
        ? moneyStops(money)
        : m === "heat"
          ? heatStops(heat, heatArea)
          : rampStops(m, acs)
    return [
      "case",
      ["==", ["typeof", ["get", m]], "number"],
      [
        "step",
        ["get", m],
        ramp[0],
        b[1],
        ramp[1],
        b[2],
        ramp[2],
        b[3],
        ramp[3],
        b[4],
        ramp[4],
      ],
      NONE,
    ]
  }
  // Every area layer on the stage shares the stage. One is a wash at full
  // strength; several are washes that add rather than hide, and the white
  // hairlines keep each region's edge readable through the others.
  const washes =
    (overlays.has("counties") ? 1 : 0) + (overlays.has("zips") ? 1 : 0)
  const stacked = fills.length + washes
  const each = stacked > 1 ? LAYER.shared : LAYER.solo
  const washOpacity = stacked > 1 ? LAYER.shared : LAYER.solo
  // A congressional district is the one without a chamber.
  const hoveredCd = hovered && !hovered.chamber ? hovered.geoid : ""
  const selectedCd = selected && !selected.chamber ? selected.geoid : ""
  const lift = [
    "case",
    ["==", ["get", "geoid"], hoveredCd],
    0.25,
    ["==", ["get", "geoid"], selectedCd],
    0.15,
    0,
  ]
  /** Which of this chamber's districts the pointer holds, if any is its own. */
  const mine = (set: ChamberDistricts, d: DistrictProps | null) =>
    d && d.chamber === set.chamber && d.state === set.fips ? d.geoid : ""

  return (
    <div className="relative h-full w-full">
      <Map
        ref={ref}
        initialViewState={{ longitude: -96.5, latitude: 38.5, zoom: 3.4 }}
        mapStyle={BASEMAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={[
          FILL_ID,
          ...chambers.map((set) => `${set.id}-fill`),
        ]}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHovered(null)
          onHover(null)
        }}
        onClick={(e) => {
          onPoint?.([e.lngLat.lng, e.lngLat.lat])
          const p = (e.features?.[0]?.properties ??
            null) as DistrictProps | null
          onSelect(sameDistrict(p, selected) ? null : p)
        }}
        onMoveEnd={(e) => {
          setZoom(e.viewState.zoom)
          setMoved((n) => n + 1)
        }}
        cursor={hovered ? "pointer" : "grab"}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {joined && (
          <Source id="cd" type="geojson" data={joined} promoteId="geoid">
            {/* The hit layer: what the pointer reads, faint so a bare map still shows where a district is. */}
            <Layer
              id={FILL_ID}
              type="fill"
              paint={{
                "fill-color": "#111827",
                "fill-opacity": ["+", fills.length ? 0 : 0.04, lift] as never,
              }}
            />
            {fills.map((m) => (
              <Layer
                key={m}
                id={`cd-fill-${m}`}
                type="fill"
                beforeId={FILL_ID}
                paint={{
                  "fill-color": fillFor(m) as never,
                  "fill-opacity": each,
                }}
              />
            ))}
            <Layer
              id="cd-line"
              type="line"
              paint={{
                "line-color": "#ffffff",
                "line-width": 0.6,
                "line-opacity": 0.9,
              }}
            />
            <Layer
              id="cd-selected"
              type="line"
              filter={["==", ["get", "geoid"], selectedCd]}
              paint={{ "line-color": "#111827", "line-width": 1 }}
            />
          </Source>
        )}
        {counties && (
          <Source id="counties" type="geojson" data={counties}>
            <Layer
              id="counties-fill"
              type="fill"
              paint={{
                "fill-color": ["get", "color"] as never,
                "fill-opacity": washOpacity,
              }}
            />
            <Layer
              id="counties-line"
              type="line"
              paint={{
                "line-color": LAYER.hairline.color,
                "line-width": LAYER.hairline.width,
                "line-opacity": LAYER.hairline.opacity,
              }}
            />
          </Source>
        )}
        {overlays.has("zips") && (
          <Source id="zips" type="geojson" data={zctas}>
            <Layer
              id="zips-fill"
              type="fill"
              paint={{
                "fill-color": ["get", "color"] as never,
                "fill-opacity": washOpacity,
              }}
            />
            <Layer
              id="zips-line"
              type="line"
              paint={{
                "line-color": LAYER.hairline.color,
                "line-width": LAYER.hairline.width,
                "line-opacity": LAYER.hairline.opacity,
              }}
            />
          </Source>
        )}
        {/* Each state chamber: an invisible fill so the pointer can find a
            district, the chamber's line over it, the held one at one pixel. */}
        {chambers.map((set) => {
          const hot = mine(set, hovered)
          const held = mine(set, selected)
          return (
            <Source
              key={set.id}
              id={set.id}
              type="geojson"
              data={set.fc}
              promoteId="geoid"
            >
              <Layer
                id={`${set.id}-fill`}
                type="fill"
                paint={{
                  "fill-color": set.color,
                  "fill-opacity": [
                    "case",
                    ["==", ["get", "geoid"], hot],
                    0.22,
                    ["==", ["get", "geoid"], held],
                    0.14,
                    0,
                  ] as never,
                }}
              />
              <Layer
                id={`${set.id}-line`}
                type="line"
                paint={{ "line-color": set.color, "line-width": 1 }}
              />
              <Layer
                id={`${set.id}-selected`}
                type="line"
                filter={["==", ["get", "geoid"], held]}
                paint={{ "line-color": "#111827", "line-width": 1.4 }}
              />
            </Source>
          )
        })}
        {statesJoined && (
          <Source id="states" type="geojson" data={statesJoined}>
            {overlays.has("delegation") && (
              <>
                <Layer
                  id="delegation-fill"
                  type="fill"
                  beforeId={FILL_ID}
                  paint={{
                    "fill-color": ["get", "splitColor"] as never,
                    "fill-opacity": each,
                  }}
                />
                <Layer
                  id="delegation-line"
                  type="line"
                  paint={{
                    "line-color": LAYER.hairline.color,
                    "line-width": LAYER.hairline.width,
                    "line-opacity": LAYER.hairline.opacity,
                  }}
                />
              </>
            )}
            <Layer
              id="state-focus"
              type="line"
              filter={["==", ["get", "fips"], focusState ?? ""]}
              paint={{ "line-color": "#111827", "line-width": 1 }}
            />
          </Source>
        )}
      </Map>
      <MapLegend
        active={[...overlays]}
        acs={acs}
        money={money}
        heat={heat}
        heatArea={heatArea}
        onHeatArea={onHeatArea}
        zoom={zoom}
      />
    </div>
  )
}
