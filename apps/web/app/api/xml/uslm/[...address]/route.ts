import { NextResponse } from "next/server"

import { gate } from "@/lib/entitlements-server"
import { expressionAt, expressionOf, expressionsOf, readUslm, splitAddress } from "@/lib/policy/expressions"

// An Expression as USLM, the stream as a product: the address is the path.
//
//   /api/xml/uslm/us/bill/119/hr/6644@2025-12-11_ih.xml   that printing
//   /api/xml/uslm/us-ny/code/agm/s3.xml?at=2024-01-01      the section as it stood on a date
//   /api/xml/uslm/us/usc/t10/s130i.xml                     the latest
//   /api/xml/uslm/us/usc/t10/s130i.json                    the Work's DocHistory, as index rows
//
// Gated as datasets are (lib/entitlements.ts): a plan's.

export const dynamic = "force-dynamic"

const stateOf = (work: string) => {
  const j = work.split("/")[1] ?? "us"
  return j === "us" ? "US" : j.replace(/^us-/, "").toUpperCase()
}

export async function GET(request: Request, { params }: { params: Promise<{ address: string[] }> }) {
  const { address: parts } = await params
  const address = splitAddress(`/${parts.map(decodeURIComponent).join("/")}`)
  if (!address) return NextResponse.json({ error: "not an address", address: `/${parts.join("/")}` }, { status: 404 })

  const { refusal } = await gate(request, { state: stateOf(address.work), entity: "datasets" })
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: { "cache-control": "private, no-store" } })

  if (address.format === "json") {
    const rows = await expressionsOf(address.work)
    if (!rows.length) return NextResponse.json({ error: "no expressions stored for this work", work: address.work }, { status: 404 })
    return NextResponse.json({ work: address.work, expressions: rows }, { headers: { "cache-control": "private, max-age=300" } })
  }
  if (address.format && address.format !== "xml") return NextResponse.json({ error: `${address.format} is not served yet; ask for .xml or .json`, work: address.work }, { status: 406 })

  const at = new URL(request.url).searchParams.get("at")
  const row = address.expression ? await expressionOf(address.work, address.expression) : await expressionAt(address.work, at)
  if (!row) return NextResponse.json({ error: at ? `no expression of this work in force on ${at}` : "no such expression", work: address.work, expression: address.expression }, { status: 404 })

  const xml = await readUslm(row)
  const name = `${row.work.slice(1).replace(/\//g, "-")}@${row.expression}.xml`
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `inline; filename="${name}"`,
      "x-govblock-address": `${row.work}@${row.expression}`,
      "x-govblock-fidelity": row.fidelity,
      ...(row.coverage === null ? {} : { "x-govblock-coverage": String(row.coverage) }),
      // A stored Expression does not change; the latest-of-a-Work does, nightly at most.
      "cache-control": address.expression ? "private, max-age=86400, immutable" : "private, max-age=3600",
    },
  })
}
