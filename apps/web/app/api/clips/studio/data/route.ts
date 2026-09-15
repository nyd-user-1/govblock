import { NextResponse } from "next/server"

import { studioData } from "@/lib/clips/studio-data"

// Studio's data: what a pasted bill or roll call link gives a template.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const link = new URL(request.url).searchParams.get("link") ?? ""
  try {
    const found = await studioData(link)
    if (!found) return NextResponse.json({ error: "Paste a bill's link or a roll call's link." }, { status: 404 })
    return NextResponse.json({ data: found.data }, { headers: { "cache-control": "private, max-age=300" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
