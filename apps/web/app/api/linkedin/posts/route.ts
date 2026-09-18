import { NextResponse } from "next/server"

import { adminId, PRIVATE, refused } from "@/lib/linkedin/session"
import { createPost, listPosts } from "@/lib/linkedin/store"

import { readInput } from "./input"

// GET: every post of the admin's. POST: a new one, always a draft; the
// client names its id so the calendar can draw it before the answer comes.

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET() {
  const userId = await adminId()
  if (!userId) return refused()
  return NextResponse.json(await listPosts(userId), { headers: PRIVATE })
}

export async function POST(request: Request) {
  const userId = await adminId()
  if (!userId) return refused()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.id !== "string" || !UUID.test(body.id)) return NextResponse.json({ error: "id must be a UUID" }, { status: 400 })
  const input = readInput(body)
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 })
  return NextResponse.json(await createPost(userId, body.id, input), { status: 201, headers: PRIVATE })
}
