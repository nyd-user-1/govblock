import { NextResponse } from "next/server"

import { newId, viewerOf } from "@/lib/clips/server"
import { q } from "@/lib/policy/db"

// Report a clip, from its menu: copyright, privacy, harm, or something else,
// with what the reporter wants known and an address to answer. Signed out is
// allowed — a rights holder need not have an account — but a copyright report
// needs the address. The row waits in `clip_reports` for an admin, who takes
// the clip down or keeps it.

export const dynamic = "force-dynamic"

const REASONS = new Set(["copyright", "privacy", "harmful", "other"])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { clipId?: string; reason?: string; details?: string; contact?: string }
  const clipId = String(body.clipId ?? "").slice(0, 80)
  const reason = String(body.reason ?? "")
  const details = String(body.details ?? "").trim().slice(0, 4000)
  const contact = String(body.contact ?? "").trim().slice(0, 254)
  if (!clipId) return NextResponse.json({ error: "Which clip?" }, { status: 400 })
  if (!REASONS.has(reason)) return NextResponse.json({ error: "Pick a reason." }, { status: 400 })
  if (contact && !EMAIL.test(contact)) return NextResponse.json({ error: "That email address does not look right." }, { status: 400 })
  if (reason === "copyright" && !contact) return NextResponse.json({ error: "A copyright report needs an email address to answer." }, { status: 400 })
  if (reason === "copyright" && !details) return NextResponse.json({ error: "Say which work is yours and where it appears in the clip." }, { status: 400 })

  const viewer = await viewerOf()
  try {
    await q(`insert into clip_reports (id, clip_id, reason, details, contact, reporter_id) values ($1, $2, $3, $4, $5, $6)`, [newId("rpt"), clipId, reason, details, contact || null, viewer?.id ?? null])
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
