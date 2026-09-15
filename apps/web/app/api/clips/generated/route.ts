import { NextResponse } from "next/server"

import { getClip, newId, viewerOf } from "@/lib/clips/server"
import { durationInFrames, parseSpec, SIZES } from "@/components/clips/studio/spec"
import { studioData } from "@/lib/clips/studio-data"
import { billHistoryProps, rollCallTallyProps } from "@/lib/clips/templates"
import { q } from "@/lib/policy/db"

// Post a generated clip (Brendan, 2026-09-14): what Generate previewed, kept
// as its template and its data, played live by every viewer's browser. The
// server reads the data again from the link's address rather than taking the
// browser's copy, so a posted clip always carries the site's own numbers.

export const dynamic = "force-dynamic"

type Body =
  | { template: "roll-call-tally"; address: { chamber: "house" | "senate"; congress: number; session: number; roll: number } }
  | { template: "bill-history"; address: { billId: number } }
  | { template: "studio"; link: string; spec: unknown }

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to post a clip." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Partial<Body>
  try {
    const id = newId("clp")
    if (body.template === "roll-call-tally" && body.address) {
      const a = body.address as Extract<Body, { template: "roll-call-tally" }>["address"]
      const found = await rollCallTallyProps({ chamber: a.chamber === "senate" ? "senate" : "house", congress: Number(a.congress), session: Number(a.session), roll: Number(a.roll) })
      if (!found) return NextResponse.json({ error: "No such roll call." }, { status: 404 })
      const p = found.props
      const chamber = p.chamber === "senate" ? "Senate" : "House"
      const title = `${p.citation ?? `${chamber} roll call ${p.roll}`}: ${p.question ?? "Roll call"}${p.result ? `, ${p.result} ${p.counts.yea}–${p.counts.nay}` : ""}`
      await q(
        `insert into clips (id, origin, status, visibility, owner_id, title, caption, duration, width, height, jurisdiction, bill_key, roll_call_chamber, roll_call_key, template, composition, published_at)
         values ($1, 'generated', 'published', 'public', $2, $3, $4, 15, 1080, 1920, 'us', $5, $6, $7, 'roll-call-tally', $8::jsonb, now())`,
        [id, viewer.id, title.slice(0, 150), p.billTitle ?? "", found.keys.bill_key, found.keys.roll_call_chamber, found.keys.roll_call_key, JSON.stringify({ template: "roll-call-tally", props: p })]
      )
    } else if (body.template === "bill-history" && body.address) {
      const found = await billHistoryProps(Number((body.address as { billId: number }).billId))
      if (!found || !found.props.milestones.length) return NextResponse.json({ error: "No such bill, or no actions on file." }, { status: 404 })
      const p = found.props
      const last = p.milestones[p.milestones.length - 1]
      await q(
        `insert into clips (id, origin, status, visibility, owner_id, title, caption, duration, width, height, jurisdiction, bill_key, template, composition, published_at)
         values ($1, 'generated', 'published', 'public', $2, $3, $4, 20, 1080, 1920, 'us', $5, 'bill-history', $6::jsonb, now())`,
        [id, viewer.id, `${p.citation}: ${p.title}`.slice(0, 150), last ? `${last.action} (${last.date})` : "", found.keys.bill_key, JSON.stringify({ template: "bill-history", props: p })]
      )
    } else if (body.template === "studio") {
      // A template built in Studio: the reader's own scenes, fed the site's data for the link.
      const b = body as Extract<Body, { template: "studio" }>
      const spec = parseSpec(b.spec)
      if (!spec) return NextResponse.json({ error: "That template could not be read." }, { status: 400 })
      const found = await studioData(String(b.link ?? ""))
      if (!found) return NextResponse.json({ error: "Paste a bill's link or a roll call's link." }, { status: 404 })
      const f = found.data.fields
      const size = SIZES[spec.aspect]
      await q(
        `insert into clips (id, origin, status, visibility, owner_id, title, caption, duration, width, height, jurisdiction, bill_key, roll_call_chamber, roll_call_key, template, composition, published_at)
         values ($1, 'generated', 'published', 'public', $2, $3, $4, $5, $6, $7, 'us', $8, $9, $10, 'studio', $11::jsonb, now())`,
        [id, viewer.id, `${f.citation ?? spec.name}${f.title ? `: ${f.title}` : ""}`.slice(0, 150), spec.name, durationInFrames(spec) / spec.fps, size.width, size.height, found.keys.bill_key, found.keys.roll_call_chamber ?? null, found.keys.roll_call_key ?? null, JSON.stringify({ template: "studio", props: { spec, data: found.data } })]
      )
    } else {
      return NextResponse.json({ error: "Nothing to post." }, { status: 400 })
    }
    return NextResponse.json({ clip: await getClip(id, viewer.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
