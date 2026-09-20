import fs from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

import { adminId } from "@/lib/linkedin/session"
import { ROUTES } from "@/lib/routes.generated"
import { PINNED } from "@/lib/lab"

// The switch on /routes (Brendan, 2026-09-20): demote a route to the lab or
// publish it again. It edits lib/lab-routes.json in the working tree, which
// scripts/routes/prune-lab.mjs reads on Amplify, so it answers in development
// alone, to an admin alone; the change reaches production with the next push.
const MANIFEST = path.join(process.cwd(), "lib/lab-routes.json")

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "The lab is edited in development." }, { status: 404 })
  if (!(await adminId())) return NextResponse.json({ error: "Only an admin can move a route." }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { path?: unknown; lab?: unknown } | null
  const route = typeof body?.path === "string" ? body.path : ""
  if (typeof body?.lab !== "boolean" || !ROUTES.some((r) => r.path === route)) return NextResponse.json({ error: "No such route." }, { status: 400 })
  if (PINNED.has(route) || route.startsWith("/lab/")) return NextResponse.json({ error: "This route does not move." }, { status: 400 })
  const demoted = new Set<string>(JSON.parse(await fs.readFile(MANIFEST, "utf8")))
  if (body.lab) demoted.add(route)
  else demoted.delete(route)
  await fs.writeFile(MANIFEST, JSON.stringify([...demoted].sort(), null, 2) + "\n")
  return NextResponse.json({ path: route, lab: body.lab })
}
