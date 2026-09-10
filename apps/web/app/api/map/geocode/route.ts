import { NextResponse } from "next/server"

// An address to a point, through the Census geocoder — public domain, no
// key, no quota (Solar's brief, 2026-09-03). Proxied so the browser talks
// to us alone. GET /api/map/geocode?q=<one-line address>

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim()
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 })
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "govblock/1.0" },
      signal: AbortSignal.timeout(15000),
    })
    const j = (await r.json()) as {
      result?: {
        addressMatches?: {
          matchedAddress: string
          coordinates: { x: number; y: number }
        }[]
      }
    }
    const m = j.result?.addressMatches?.[0]
    if (!m) return NextResponse.json({ match: null })
    return NextResponse.json(
      {
        match: {
          address: m.matchedAddress,
          lng: m.coordinates.x,
          lat: m.coordinates.y,
        },
      },
      { headers: { "cache-control": "public, s-maxage=86400" } }
    )
  } catch (error) {
    console.error("geocode failed", error)
    return NextResponse.json(
      { error: "The geocoder could not be reached." },
      { status: 502 }
    )
  }
}
