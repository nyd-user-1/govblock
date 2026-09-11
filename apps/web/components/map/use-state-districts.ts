"use client"

import * as React from "react"

import { geoUrl } from "@/lib/map/geo-url"
import { empty, grow, type Bounds } from "@/lib/map/bounds"
import { overlay, type OverlayId } from "@/lib/map/overlays"
import type { DistrictProps } from "@/components/map/districts-map"
import { loadMembers, type Seat } from "@/lib/map/join"

// The state chambers a reader has switched on, loaded once each and kept.
// The map draws them, the panel's tree lists them and the fly-to needs each
// district's box, so the file is fetched here rather than three times over.
// Switching a chamber off leaves it in the cache: switching it back on is
// then free, and the cache is at most a hundred small files.

export type ChamberDistricts = {
  id: OverlayId
  /** The state's FIPS, as the features carry it. */
  fips: string
  chamber: string
  color: string
  fc: GeoJSON.FeatureCollection
  /** A box per district, by geoid. */
  bounds: Record<string, Bounds>
  /** The districts in number order, for the tree. */
  list: DistrictProps[]
  /** Who sits for each district, by geoid — a seat or two; empty where the roster is silent. */
  members: Record<string, Seat[]>
}

async function load(id: OverlayId): Promise<ChamberDistricts | null> {
  const o = overlay(id)
  if (!o?.state || !o.chamber) return null
  const [response, members] = await Promise.all([
    fetch(geoUrl(`/geo/${id}.geojson`)),
    loadMembers(id),
  ])
  if (!response.ok) return null
  const fc = (await response.json()) as GeoJSON.FeatureCollection
  const bounds: Record<string, Bounds> = {}
  const list: DistrictProps[] = []
  for (const feature of fc.features) {
    const p = feature.properties as DistrictProps
    bounds[p.geoid] = grow(bounds[p.geoid] ?? empty(), feature.geometry)
    list.push(p)
  }
  list.sort((a, b) => Number(a.district) - Number(b.district))
  return {
    id,
    fips:
      (fc.features[0]?.properties as DistrictProps | undefined)?.state ?? "",
    chamber: o.chamber,
    color: o.color ?? "#059669",
    fc,
    bounds,
    list,
    members,
  }
}

export function useStateDistricts(active: OverlayId[]) {
  const [loaded, setLoaded] = React.useState<Record<string, ChamberDistricts>>(
    {}
  )
  const wanted = active.filter((id) => overlay(id)?.state).join(",")

  React.useEffect(() => {
    let live = true
    const missing = wanted
      .split(",")
      .filter(Boolean)
      .filter((id) => !(id in loaded))
    if (!missing.length) return
    Promise.all(missing.map((id) => load(id as OverlayId))).then((sets) => {
      if (!live) return
      setLoaded((prev) => {
        const next = { ...prev }
        for (const set of sets) if (set) next[set.id] = set
        return next
      })
    })
    return () => {
      live = false
    }
    // `loaded` is read but deliberately not a dependency: it only ever grows,
    // and depending on it would re-run the effect on every load it caused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  return React.useMemo(
    () =>
      active
        .map((id) => loaded[id])
        .filter((set): set is ChamberDistricts => !!set),
    [active, loaded]
  )
}
