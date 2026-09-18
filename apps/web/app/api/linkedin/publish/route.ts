import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { adminId, PRIVATE, refused } from "@/lib/linkedin/session"
import { publishDue } from "@/lib/linkedin/store"

// POST /api/linkedin/publish. With `x-linkedin-cron` set to
// LINKEDIN_CRON_SECRET it sends every scheduled post that is due: the timer
// calls it each minute (scripts/linkedin/tick.mjs). From an admin's session
// with `{ id }` it sends that one post now.

export const dynamic = "force-dynamic"

function fromTimer(request: Request) {
  const secret = process.env.LINKEDIN_CRON_SECRET
  const presented = request.headers.get("x-linkedin-cron")
  if (!secret || !presented || presented.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(presented), Buffer.from(secret))
}

export async function POST(request: Request) {
  if (fromTimer(request)) return NextResponse.json(await publishDue(), { headers: PRIVATE })
  const userId = await adminId()
  if (!userId) return refused()
  const body = (await request.json().catch(() => ({}))) as { id?: unknown }
  if (typeof body.id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 })
  return NextResponse.json(await publishDue({ userId, id: body.id }), { headers: PRIVATE })
}
