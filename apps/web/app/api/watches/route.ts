import { NextResponse } from "next/server"

import { billLabels, createWatch, listWatches, usage } from "@/lib/watches/db"
import { who } from "@/lib/watches/session"
import { templateById, type Step, type Trigger } from "@/lib/watches/templates"

// A reader's watches. GET lists them with their run counts and the figures
// for the rail; POST makes one, from a template and answers, or from a
// trigger and steps written out.

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const [watches, use] = await Promise.all([listWatches(user.id), usage(user.id)])
  const ids = watches.map((w) => ("bill_id" in w.trigger ? Number(w.trigger.bill_id) : 0)).filter(Boolean)
  const labels = await billLabels(ids)
  return NextResponse.json(
    { user, watches: watches.map((w) => ({ ...w, bill_label: "bill_id" in w.trigger && w.trigger.bill_id ? (labels.get(Number(w.trigger.bill_id)) ?? null) : null })), usage: use },
    { headers: { "cache-control": "private, no-store" } }
  )
}

export async function POST(request: Request) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    template?: string
    answers?: Record<string, string | number | undefined>
    via?: "inbox" | "email" | "slack" | "discord" | "webhook"
    to?: string
    approve?: boolean
    trigger?: Trigger
    steps?: Step[]
  }
  let trigger = body.trigger
  let steps = body.steps
  if (body.template) {
    const t = templateById(body.template)
    if (!t) return NextResponse.json({ error: "no such template" }, { status: 400 })
    const built = t.build(body.answers ?? {}, body.via ?? "inbox", body.to || undefined, body.approve)
    trigger = built.trigger
    steps = built.steps
  }
  if (!trigger || !steps?.length || !body.name?.trim()) return NextResponse.json({ error: "a name, a trigger and steps are required" }, { status: 400 })
  const id = await createWatch(user.id, user, { name: body.name.trim(), template: body.template ?? null, trigger, steps })
  return NextResponse.json({ id })
}
