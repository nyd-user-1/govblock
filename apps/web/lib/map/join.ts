// The join (Brendan, 2026-09-10: "a join is a join"): one point on the
// ground, tested against every boundary set at once, answered with the
// bodies that sit for it. Point-in-polygon by ray casting on the same
// generalized files the map draws — good to a few hundred metres, which is
// the honest limit of these files and is said in the card. Files load once
// and stay.

import type {
  Feature as GeoFeature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson"

import { FIPS_TO_STATE } from "@/lib/map/fips"
import { chambersOfState } from "@/lib/map/state-districts"

export type LngLat = [number, number]
export type Seat = {
  name: string
  party: string | null
  people_id: number | null
}
export type Members = Record<string, Seat[]>

export type Representation = {
  point: LngLat
  state: string | null
  congress: { geoid: string; district: string; seat: Seat | null } | null
  chambers: {
    id: string
    chamber: string
    geoid: string
    district: string
    name: string
    seats: Seat[]
  }[]
  county: { geoid: string; name: string } | null
}

type Feature = GeoFeature<Polygon | MultiPolygon>

const files = new Map<string, Promise<FeatureCollection>>()
export function loadGeo(path: string) {
  let p = files.get(path)
  if (!p) {
    p = fetch(path).then((r) => r.json() as Promise<FeatureCollection>)
    files.set(path, p)
  }
  return p
}
const memberFiles = new Map<string, Promise<Members>>()
export function loadMembers(id: string) {
  let p = memberFiles.get(id)
  if (!p) {
    p = fetch(`/geo/${id}-members.json`)
      .then((r) =>
        r.ok ? (r.json() as Promise<{ districts: Members }>) : { districts: {} }
      )
      .then((j) => j.districts ?? {})
      .catch(() => ({}))
    memberFiles.set(id, p)
  }
  return p
}

function inRing(ring: number[][], [x, y]: LngLat) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}
function inPolygon(coords: number[][][], p: LngLat) {
  if (!coords.length || !inRing(coords[0], p)) return false
  for (let i = 1; i < coords.length; i++) if (inRing(coords[i], p)) return false
  return true
}
export function contains(f: Feature, p: LngLat) {
  const g = f.geometry
  if (g.type === "Polygon") return inPolygon(g.coordinates, p)
  return g.coordinates.some((poly) => inPolygon(poly, p))
}
export function find(fc: FeatureCollection, p: LngLat) {
  return (fc.features as Feature[]).find((f) => contains(f, p)) ?? null
}

/** Who sits for a point, in every body whose lines the reader may draw. */
export async function representationAt(
  point: LngLat,
  party: Record<
    string,
    { party: string | null; name: string | null; people_id: number | null }
  >,
  mayOpen: (overlayId: string) => boolean
): Promise<Representation> {
  const cd = await loadGeo("/geo/cd119.geojson")
  const hit = find(cd, point)
  const props = hit?.properties as
    | { geoid: string; state: string; district: string }
    | undefined
  const state = props?.state ?? null
  const congress = props
    ? {
        geoid: props.geoid,
        district: props.district,
        seat: party[props.geoid]?.name
          ? {
              name: party[props.geoid].name!,
              party: party[props.geoid].party,
              people_id: party[props.geoid].people_id,
            }
          : null,
      }
    : null

  const chambers: Representation["chambers"] = []
  const code = state ? FIPS_TO_STATE[state] : undefined
  if (code) {
    for (const c of chambersOfState(code)) {
      if (!mayOpen(c.id)) continue
      const [fc, members] = await Promise.all([
        loadGeo(`/geo/${c.id}.geojson`),
        loadMembers(c.id),
      ])
      const f = find(fc, point)
      if (!f) continue
      const p = f.properties as {
        geoid: string
        district: string
        name: string
      }
      chambers.push({
        id: c.id,
        chamber: c.chamber,
        geoid: p.geoid,
        district: p.district,
        name: p.name,
        seats: members[p.geoid] ?? [],
      })
    }
  }

  const counties = await loadGeo("/geo/counties.geojson")
  const cf = find(counties, point)
  const cp = cf?.properties as { geoid: string; name: string } | undefined
  return {
    point,
    state,
    congress,
    chambers,
    county: cp ? { geoid: cp.geoid, name: cp.name } : null,
  }
}
