// A box in lon/lat, and the one walk that grows it. The map fits to these,
// the trees fly to them; two files compute them, so the walk lives here.

export type Bounds = [number, number, number, number]

export const EMPTY: Bounds = [180, 90, -180, -90]

export const empty = (): Bounds => [...EMPTY] as Bounds

export const isEmpty = (box: Bounds) => box[0] > box[2] || box[1] > box[3]

/** Every coordinate in a geometry, however deeply the rings nest. */
export function grow(box: Bounds, geometry: GeoJSON.Geometry | null): Bounds {
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as [number, number]
      box[0] = Math.min(box[0], x)
      box[1] = Math.min(box[1], y)
      box[2] = Math.max(box[2], x)
      box[3] = Math.max(box[3], y)
    } else if (Array.isArray(c)) c.forEach(walk)
  }
  if (geometry && "coordinates" in geometry) walk(geometry.coordinates)
  return box
}
