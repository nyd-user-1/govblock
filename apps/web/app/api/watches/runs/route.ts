import { NextResponse } from "next/server"

import { listRuns } from "@/lib/watches/db"
import { who } from "@/lib/watches/session"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  return NextResponse.json({ runs: await listRuns(user.id) }, { headers: { "cache-control": "private, no-store" } })
}
