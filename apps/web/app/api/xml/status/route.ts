import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"

import { readerOf } from "@/lib/entitlements-server"
import { pipelineStatus } from "@/lib/policy/expressions"
import coverage from "@/lib/xml/coverage.generated.json"

// What the Ingestion page draws: the store, the queue, the rate, the
// fall-outs, the coverage file and the windows' reports. An admin's.

export const dynamic = "force-dynamic"

async function reports() {
  // The reports live in the checkout (apps/web/docs/xml); a deployed build without them draws none.
  const dir = join(process.cwd(), "docs/xml")
  try {
    const names = (await readdir(dir)).filter((n) => n.endsWith(".md")).sort()
    return await Promise.all(names.map(async (name) => ({ name, body: await readFile(join(dir, name), "utf8") })))
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const reader = await readerOf(request)
  if (!reader.admin) return NextResponse.json({ error: "The Ingestion page is an admin's." }, { status: 403, headers: { "cache-control": "private, no-store" } })
  const [status, docs] = await Promise.all([pipelineStatus(), reports()])
  return NextResponse.json({ ...status, coverage, reports: docs }, { headers: { "cache-control": "private, no-store" } })
}
