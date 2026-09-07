import { NextResponse } from "next/server"

import { deleteWatch, getWatch, listRuns, updateWatch } from "@/lib/watches/db"
import { who } from "@/lib/watches/session"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const { id } = await params
  const watch = await getWatch(user.id, id)
  if (!watch) return NextResponse.json({ error: "not found" }, { status: 404 })
  const runs = await listRuns(user.id, id)
  return NextResponse.json({ watch, runs }, { headers: { "cache-control": "private, no-store" } })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { name?: string; enabled?: boolean }
  await updateWatch(user.id, id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const { id } = await params
  await deleteWatch(user.id, id)
  return NextResponse.json({ ok: true })
}
