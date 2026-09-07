import { NextResponse } from "next/server"

import { answerApproval, markRead } from "@/lib/watches/db"
import { who } from "@/lib/watches/session"

// One inbox item. POST { action: "approve" | "decline" | "read" }.

export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { action?: string }
  const n = Number(id)
  if (body.action === "approve" || body.action === "decline") {
    const ok = await answerApproval(user.id, n, body.action === "approve")
    return NextResponse.json({ ok })
  }
  await markRead(user.id, n)
  return NextResponse.json({ ok: true })
}
