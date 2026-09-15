import { NextResponse } from "next/server"

import { parseSpec } from "@/components/clips/studio/spec"
import { newId, viewerOf } from "@/lib/clips/server"
import { one, q } from "@/lib/policy/db"

// A reader's own Studio templates (sql/023_clip_templates.sql). GET lists
// them, or with ?id= reads any one (the collaborate link opens it in anyone's
// Studio, where saving makes their own copy); POST saves one (a new one, or an
// existing one of the reader's by id), DELETE removes one.

export const dynamic = "force-dynamic"

type Row = { id: string; name: string; spec: string; updated_at: string }

const shape = (r: Row) => {
  const spec = parseSpec(JSON.parse(r.spec))
  return spec ? { id: r.id, name: r.name, updatedAt: r.updated_at, spec } : null
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (id) {
    const row = await one<Row>(`select id, name, spec::text spec, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') updated_at from clip_templates where id = $1`, [id])
    const template = row ? shape(row) : null
    if (!template) return NextResponse.json({ error: "No such template." }, { status: 404 })
    return NextResponse.json({ template })
  }
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ templates: [] })
  const rows = await q<Row>(`select id, name, spec::text spec, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') updated_at from clip_templates where owner_id = $1 order by updated_at desc limit 100`, [viewer.id])
  return NextResponse.json({ templates: rows.map(shape).filter(Boolean) }, { headers: { "cache-control": "private, no-store" } })
}

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to save a template." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { id?: string; spec?: unknown }
  const spec = parseSpec(body.spec)
  if (!spec) return NextResponse.json({ error: "That template could not be read." }, { status: 400 })
  const name = String(spec.name || "Untitled").trim().slice(0, 80) || "Untitled"
  if (body.id) {
    const mine = await one<{ id: string }>(`select id from clip_templates where id = $1 and owner_id = $2`, [body.id, viewer.id])
    if (mine) {
      await q(`update clip_templates set name = $2, spec = $3::jsonb, updated_at = now() where id = $1`, [body.id, name, JSON.stringify({ ...spec, name })])
      return NextResponse.json({ id: body.id })
    }
  }
  const id = newId("tpl")
  await q(`insert into clip_templates (id, owner_id, name, spec) values ($1, $2, $3, $4::jsonb)`, [id, viewer.id, name, JSON.stringify({ ...spec, name })])
  return NextResponse.json({ id })
}

export async function DELETE(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const id = new URL(request.url).searchParams.get("id") ?? ""
  await q(`delete from clip_templates where id = $1 and owner_id = $2`, [id, viewer.id])
  return NextResponse.json({ ok: true })
}
