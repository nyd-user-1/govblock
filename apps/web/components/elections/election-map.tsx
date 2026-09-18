"use client"

import * as React from "react"
import MapGL, { Layer, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

import type { SimSeat } from "@/lib/elections/seats"
import { BASEMAP_STYLE } from "@/lib/map/basemap"
import { empty, grow, isEmpty } from "@/lib/map/bounds"
import { LAYER, NO_DATA, PARTY_COLORS, RAMP } from "@/lib/map/palette"

// The simulator map's stage: one view's district shapes, coloured by the
// seats the rule left them with (lib/elections/seats). A district the rule
// changed — flipped by a swing, or moved to November by an open primary —
// wears a dark outline. A district with no race that year (half a senate
// is up) is drawn blank. The House opens on the contiguous states; a state
// chamber frames its own districts, so Alaska's Aleutians never stretch the
// view around the world.
//
// Either frame is fitted, never a fixed zoom: this stage keeps the rail open
// and a 400px panel beside it, so it has about half the room /map's has, and
// the country has to be sized to the room it is given. It is fitted again
// when the rail opens or the window changes, until the reader moves the map
// themselves.

export type ColorBy = "party" | "margin"
export const BANDS = ["Under 5 points", "5 to 10", "10 to 20", "20 or more", "No opponent"]
const SPLIT = "#a78bfa"
const CONUS: [[number, number], [number, number]] = [
  [-124.8, 24.4],
  [-66.9, 49.4],
]
const PAD = 24

/** 0 close (under 5 points) … 3 safe (20 or more) … 4 nobody ran against the winner. */
function band(seats: SimSeat[] | undefined) {
  if (!seats?.length) return null
  if (seats.every((s) => !s.contested)) return 4
  const margin = Math.min(...seats.filter((s) => s.contested && s.margin !== null).map((s) => s.margin as number))
  if (!Number.isFinite(margin)) return null
  return margin < 5 ? 0 : margin < 10 ? 1 : margin < 20 ? 2 : 3
}

export function ElectionMap({
  shapes,
  seats,
  colorBy,
  frame,
  selected,
  onSelect,
  onHover,
}: {
  shapes: string
  seats: SimSeat[] | null
  colorBy: ColorBy
  /** The contiguous states, or the districts on the map. */
  frame: "conus" | "fit"
  selected: string | null
  onSelect: (key: string | null) => void
  onHover?: (key: string | null, e?: MapLayerMouseEvent) => void
}) {
  const ref = React.useRef<MapRef>(null)
  const stage = React.useRef<HTMLDivElement>(null)
  /** Set once the reader pans or zooms: their view outranks a refit. */
  const moved = React.useRef(false)
  const [data, setData] = React.useState<GeoJSON.FeatureCollection | null>(null)
  const [hovered, setHovered] = React.useState<string | null>(null)

  React.useEffect(() => {
    let live = true
    setData(null)
    fetch(shapes)
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((fc) => live && setData(fc))
      .catch(() => live && setData({ type: "FeatureCollection", features: [] }))
    return () => {
      live = false
    }
  }, [shapes])

  const byKey = React.useMemo(() => {
    const m = new Map<string, SimSeat[]>()
    for (const s of seats ?? []) {
      const a = m.get(s.key) ?? []
      a.push(s)
      m.set(s.key, a)
    }
    return m
  }, [seats])

  const joined = React.useMemo(() => {
    if (!data) return null
    return {
      ...data,
      features: data.features.map((f) => {
        const key = String((f.properties as { key: string }).key)
        const ss = byKey.get(key)
        const parties = new Set((ss ?? []).map((s) => s.now))
        const holder = !parties.size ? null : parties.size > 1 ? "split" : [...parties][0]
        const changed = (ss ?? []).some((s) => s.now !== s.party || s.moved) ? 1 : 0
        return { ...f, properties: { ...f.properties, key, holder, band: band(ss), changed } }
      }),
    }
  }, [data, byKey])

  const fit = React.useCallback(
    (duration: number) => {
      if (!ref.current) return
      if (frame === "conus") return void ref.current.fitBounds(CONUS, { padding: PAD, duration })
      if (!data) return
      const box = empty()
      for (const f of data.features) grow(box, f.geometry)
      if (!isEmpty(box)) ref.current.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: PAD, duration })
    },
    [data, frame]
  )

  React.useEffect(() => {
    moved.current = false
    fit(700)
  }, [fit])

  // The rail opening and the window changing both take room from the stage;
  // the country is sized to whatever is left.
  React.useEffect(() => {
    const el = stage.current
    if (!el) return
    let t: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => !moved.current && fit(0), 150)
    })
    ro.observe(el)
    return () => {
      clearTimeout(t)
      ro.disconnect()
    }
  }, [fit])

  const fill =
    colorBy === "party"
      ? ["match", ["get", "holder"], "D", PARTY_COLORS.D, "R", PARTY_COLORS.R, "I", PARTY_COLORS.I, "O", "#9ca3af", "split", SPLIT, NO_DATA]
      : ["match", ["get", "band"], 0, RAMP[0], 1, RAMP[1], 2, RAMP[2], 3, RAMP[3], 4, RAMP[4], NO_DATA]

  const keyAt = (e: MapLayerMouseEvent) => (e.features?.[0]?.properties as { key?: string } | undefined)?.key ?? null

  return (
    <div ref={stage} className="relative h-full w-full">
      <MapGL
        ref={ref}
        initialViewState={{ bounds: CONUS, fitBoundsOptions: { padding: PAD } }}
        mapStyle={BASEMAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["districts-fill"]}
        onMoveStart={(e) => {
          if (e.originalEvent) moved.current = true
        }}
        onMouseMove={(e) => {
          const k = keyAt(e)
          setHovered(k)
          onHover?.(k, e)
        }}
        onMouseLeave={() => {
          setHovered(null)
          onHover?.(null)
        }}
        onClick={(e) => {
          const key = keyAt(e)
          onSelect(key === selected ? null : key)
        }}
        cursor={hovered ? "pointer" : "grab"}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {joined && (
          <Source id="districts" type="geojson" data={joined} promoteId="key">
            <Layer
              id="districts-fill"
              type="fill"
              paint={{
                // @ts-expect-error MapLibre's expression types do not model a match built at runtime.
                "fill-color": fill,
                "fill-opacity": ["case", ["==", ["get", "key"], hovered ?? ""], LAYER.solo + LAYER.lift, LAYER.solo],
              }}
            />
            <Layer id="districts-line" type="line" paint={{ "line-color": LAYER.hairline.color, "line-width": LAYER.hairline.width, "line-opacity": LAYER.hairline.opacity }} />
            <Layer id="districts-changed" type="line" filter={["==", ["get", "changed"], 1]} paint={{ "line-color": "#111827", "line-width": 2 }} />
            <Layer id="districts-selected" type="line" filter={["==", ["get", "key"], selected ?? ""]} paint={{ "line-color": "#111827", "line-width": 2.5, "line-dasharray": [1.5, 1] }} />
          </Source>
        )}
      </MapGL>
    </div>
  )
}
