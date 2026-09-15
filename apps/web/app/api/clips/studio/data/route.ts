import { NextResponse } from "next/server"

import { studioData } from "@/lib/clips/studio-data"

// Studio's data: what a pasted link gives a template.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const link = new URL(request.url).searchParams.get("link") ?? ""
  try {
    const found = await studioData(link)
    if (!found) return NextResponse.json({ error: "Paste a link to a bill, a roll call, a member, a committee, a party, a session's roll calls, or a state." }, { status: 404 })
    return NextResponse.json({ data: found.data }, { headers: { "cache-control": "private, max-age=300" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
