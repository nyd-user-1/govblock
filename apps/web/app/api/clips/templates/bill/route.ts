import { NextResponse } from "next/server"

import { billHistoryProps } from "@/lib/clips/templates"

// The bill history's props for /clips's Generate panel, by the bill's id as
// its page's address carries it (/bills/2058568). Open to every reader, like
// the bill pages themselves.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Paste a bill's link." }, { status: 400 })
  try {
    const found = await billHistoryProps(id)
    if (!found) return NextResponse.json({ error: "No such bill." }, { status: 404 })
    if (!found.props.milestones.length) return NextResponse.json({ error: "This bill has no actions on file yet." }, { status: 404 })
    return NextResponse.json({ address: { billId: id }, ...found }, { headers: { "cache-control": "private, max-age=300" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
