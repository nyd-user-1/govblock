import { NextResponse } from "next/server"

import { credentials } from "@/lib/linkedin/api"
import { adminId, PRIVATE, refused } from "@/lib/linkedin/session"
import { accountOf, disconnect } from "@/lib/linkedin/store"

// GET: whether LinkedIn is connected, as whom, and until when. DELETE forgets
// the connection; LinkedIn keeps the grant until the member revokes it there.

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await adminId()
  if (!userId) return refused()
  if (!credentials()) return NextResponse.json({ connected: false, configured: false }, { headers: PRIVATE })
  return NextResponse.json(await accountOf(userId), { headers: PRIVATE })
}

export async function DELETE() {
  const userId = await adminId()
  if (!userId) return refused()
  await disconnect(userId)
  return NextResponse.json({ ok: true }, { headers: PRIVATE })
}
