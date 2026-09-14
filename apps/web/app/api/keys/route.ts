import { NextResponse } from "next/server"

import { createApiKey, getUsageForUser, listApiKeys, planOf } from "@/lib/api-keys"
import { PLANS } from "@/lib/plans"
import { who } from "@/lib/watches/session"

// The signed-in reader's API keys (2026-09-13): GET lists them with the
// plan's allowance and this month's usage; POST mints one, shown once in the
// response and never again. The plan is re-read here on every call — the
// page's idea of it is never trusted.

export const dynamic = "force-dynamic"
const PRIVATE = { "cache-control": "private, no-store" }

export async function GET() {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const [plan, keys, usage] = await Promise.all([planOf(user.id), listApiKeys(user.id), getUsageForUser(user.id)])
  return NextResponse.json({ plan, spec: PLANS[plan], keys, usage }, { headers: PRIVATE })
}

export async function POST(request: Request) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { name?: unknown }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) || null : null
  const plan = await planOf(user.id)
  const result = await createApiKey(user.id, plan, name)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403, headers: PRIVATE })
  return NextResponse.json(result, { headers: PRIVATE })
}
