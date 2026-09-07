import { NextResponse } from "next/server"

import { listDeliveries } from "@/lib/watches/db"
import { who } from "@/lib/watches/session"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  return NextResponse.json({ items: await listDeliveries(user.id) }, { headers: { "cache-control": "private, no-store" } })
}
