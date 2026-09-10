"use client"

import { stateName } from "@/lib/filters"
import { fmtCompact } from "@/lib/format"
import { overlay, type OverlayId } from "@/lib/map/overlays"
import {
  heatStops,
  moneyStops,
  PARTY_COLORS,
  RAMP,
  rampStops,
  type Acs,
  type Heat,
  type Money,
} from "@/components/map/districts-map"
import { HEAT_RAMP, MONEY_RAMP, SPLIT_RAMP, NO_DATA } from "@/lib/map/palette"

// The key, at the map's bottom-left, one block per overlay that is on, all
// the same shape: a name, then swatch-and-label pairs in a row. A party is a
// square of its colour; a counted reading is five squares with the step each
// begins at, the first reading "under" the second; a boundary is a line. A
// state chamber is named for the state that seats it, since a dozen may be
// on at once and every upper house is drawn the same green.

type Item = { swatch: React.ReactNode; label: string }

function Block({
  title,
  items,
  note,
}: {
  title: string
  items: Item[]
  note?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium">{title}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((it, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums"
          >
            {it.swatch}
            {it.label}
          </span>
        ))}
      </div>
      {note && (
        <span className="text-[10px] text-muted-foreground">{note}</span>
      )}
    </div>
  )
}

const square = (c: string) => (
  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c }} />
)
const line = (c: string, dashed = false) => (
  <span
    className="inline-block h-0 w-4 shrink-0 border-t-2"
    style={{ borderColor: c, borderStyle: dashed ? "dashed" : "solid" }}
  />
)

export function MapLegend({
  active,
  acs,
  money,
  heat,
  heatArea,
  onHeatArea,
  zoom,
}: {
  active: OverlayId[]
  acs: Acs
  money: Money
  heat: Heat
  heatArea: string
  onHeatArea: (area: string) => void
  zoom: number
}) {
  if (!active.length) return null
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[min(92%,26rem)] flex-col gap-3 rounded-xl border bg-background/90 p-3 shadow-sm backdrop-blur-sm [&_select]:pointer-events-auto">
      {active.map((id) => {
        const o = overlay(id)
        if (id === "party")
          return (
            <Block
              key={id}
              title="Party"
              items={[
                { swatch: square(PARTY_COLORS.D), label: "Democrat" },
                { swatch: square(PARTY_COLORS.R), label: "Republican" },
                { swatch: square(PARTY_COLORS.I), label: "Independent" },
                { swatch: square("#e5e7eb"), label: "No member" },
              ]}
            />
          )
        if (id === "population" || id === "income") {
          const breaks = rampStops(id, acs)
          const f = (v: number) => fmtCompact(v, id === "income")
          return (
            <Block
              key={id}
              title={o.label}
              items={RAMP.map((c, i) => ({
                swatch: square(c),
                label: i === 0 ? `< ${f(breaks[1])}` : f(breaks[i]),
              }))}
              note="ACS 2023 five-year, per district"
            />
          )
        }
        if (id === "delegation")
          return (
            <Block
              key={id}
              title="Delegation split"
              items={[
                { swatch: square(SPLIT_RAMP[0]), label: "All R" },
                { swatch: square(SPLIT_RAMP[2]), label: "Even" },
                { swatch: square(SPLIT_RAMP[4]), label: "All D" },
                { swatch: square(NO_DATA), label: "No seats" },
              ]}
              note="Each state by how its House seats divide"
            />
          )
        if (id === "money") {
          const b = moneyStops(money)
          const f = (v: number) => fmtCompact(v, true)
          return (
            <Block
              key={id}
              title="Money raised"
              items={MONEY_RAMP.map((c, i) => ({
                swatch: square(c),
                label: i === 0 ? `< ${f(b[1])}` : f(b[i]),
              }))}
              note="FEC receipts, the member's latest cycle"
            />
          )
        }
        if (id === "heat") {
          const b = heatStops(heat, heatArea)
          const f = (v: number) => fmtCompact(v, false)
          return (
            <div key={id} className="flex flex-col gap-1.5">
              <select
                value={heatArea}
                onChange={(e) => onHeatArea(e.target.value)}
                aria-label="Which policy area the heat is of"
                className="w-fit max-w-full cursor-pointer rounded-md border bg-background px-1.5 py-0.5 text-[11px] font-medium"
              >
                {heat.areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {HEAT_RAMP.map((c, i) => (
                  <span
                    key={c}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums"
                  >
                    {square(c)}
                    {i === 0 ? `< ${f(b[1])}` : f(b[i])}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Bills the member leads in this area
              </span>
            </div>
          )
        }
        if (id === "counties")
          return (
            <Block
              key={id}
              title="Counties"
              items={[
                {
                  swatch: square("#cbd5e1"),
                  label: "3,235, each its own colour",
                },
              ]}
            />
          )
        if (id === "zips")
          return (
            <Block
              key={id}
              title="ZIP codes"
              items={[
                {
                  swatch: square("#cbd5e1"),
                  label:
                    zoom < 7
                      ? "Zoom in to draw"
                      : "ZCTA 2020, each its own colour",
                },
              ]}
            />
          )
        if (o.state)
          return (
            <Block
              key={id}
              title={`${stateName(o.state)} ${o.chamber}`}
              items={[
                {
                  swatch: line(o.color!),
                  label: `${o.count} districts, 2026 lines`,
                },
              ]}
            />
          )
        return (
          <Block
            key={id}
            title={o.label}
            items={[{ swatch: line(o.color!), label: "2020 lines" }]}
          />
        )
      })}
    </div>
  )
}
