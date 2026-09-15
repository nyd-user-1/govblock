import { NextResponse } from "next/server"

import { latestRollCall, rollCallTallyProps } from "@/lib/clips/templates"

// The roll call tally's props for /clips's Generate panel: a roll call by
// chamber, congress, session and number, or the newest House roll call when
// none is named. Open to every reader, like the roll call pages themselves.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const chamber = url.searchParams.get("chamber") === "senate" ? "senate" : "house"
  const congress = Number(url.searchParams.get("congress"))
  const session = Number(url.searchParams.get("session"))
  const roll = Number(url.searchParams.get("roll"))
  const named = [congress, session, roll].every((v) => Number.isInteger(v) && v > 0)
  try {
    const address = named ? { chamber, congress, session, roll } as const : await latestRollCall(chamber)
    const found = address ? await rollCallTallyProps(address) : null
    if (!address || !found) return NextResponse.json({ error: "No such roll call." }, { status: 404 })
    return NextResponse.json({ address, ...found }, { headers: { "cache-control": "private, max-age=300" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
