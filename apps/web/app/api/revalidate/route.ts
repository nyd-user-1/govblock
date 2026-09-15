import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"

import { viewerOf } from "@/lib/clips/server"

// Clears the read cache (lib/policy/db.ts) after a load, so readers see the
// freshest data without the cluster answering every page open. An admin's
// session or the site's own secret opens the door; the loaders call it with
// the secret when they finish.
//
//   POST /api/revalidate            { "all": true }
//   POST /api/revalidate            { "tables": ["Bills", "BillTexts"] }
//   POST /api/revalidate            { "tags": ["table:bills"] }
//   Authorization: Bearer <AUTH_SECRET>   (or a signed-in admin)
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  const secret = process.env.AUTH_SECRET
  const viewer = bearer ? null : await viewerOf()
  if (!(secret && bearer && bearer === secret) && !viewer?.admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as { all?: boolean; tables?: string[]; tags?: string[] }
  const tags = new Set<string>()
  if (body.all) tags.add("policy")
  for (const t of body.tables ?? []) tags.add(`table:${String(t).toLowerCase()}`)
  for (const t of body.tags ?? []) tags.add(String(t))
  if (tags.size === 0) return NextResponse.json({ error: "Name tables, tags, or all." }, { status: 400 })
  for (const tag of tags) revalidateTag(tag, "max")
  return NextResponse.json({ cleared: [...tags] })
}
