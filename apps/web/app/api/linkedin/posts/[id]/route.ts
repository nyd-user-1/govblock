import { NextResponse } from "next/server"

import { adminId, PRIVATE, refused } from "@/lib/linkedin/session"
import { deletePost, updatePost } from "@/lib/linkedin/store"

import { readInput } from "../input"

// PATCH changes a post that has not gone out (409 once it has); DELETE
// removes it from the calendar, not from LinkedIn.

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const unknown = () => NextResponse.json({ error: "unknown post" }, { status: 404 })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await adminId()
  if (!userId) return refused()
  const { id } = await params
  if (!UUID.test(id)) return unknown()
  const input = readInput((await request.json().catch(() => ({}))) as Record<string, unknown>, userId)
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 })
  const post = await updatePost(userId, id, input)
  if (!post) return NextResponse.json({ error: "That post has already gone out, or is not yours." }, { status: 409 })
  return NextResponse.json(post, { headers: PRIVATE })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await adminId()
  if (!userId) return refused()
  const { id } = await params
  if (!UUID.test(id)) return unknown()
  await deletePost(userId, id)
  return NextResponse.json({ ok: true }, { headers: PRIVATE })
}
