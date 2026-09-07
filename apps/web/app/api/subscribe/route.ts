import { NextResponse } from "next/server"

import { q } from "@/lib/policy/db"

// The home page's Subscribe card posts here: an address and what it wants to
// hear about, kept in Aurora's Subscribers table (Brendan, 2026-09-07: "turn
// that into an enter your email subscribe"). Nothing is sent yet; the list
// is the record of who asked.

export const dynamic = "force-dynamic"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: Request) {
  let body: { email?: string; topics?: string[]; state?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "A JSON body with an email is required." }, { status: 400 })
  }
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase()
  if (!EMAIL.test(email)) return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 })
  const topics = Array.isArray(body.topics) ? body.topics.map(String).filter(Boolean).slice(0, 8) : []
  const state =
    String(body.state ?? "")
      .toUpperCase()
      .slice(0, 2) || null
  try {
    await q(
      `create table if not exists "Subscribers" (
         email text primary key, topics text[] not null default '{}', state text,
         created_at timestamptz not null default now(), updated_at timestamptz not null default now())`
    )
    await q(
      `insert into "Subscribers" (email, topics, state) values ($1, $2::text[], $3)
       on conflict (email) do update set topics = excluded.topics, state = excluded.state, updated_at = now()`,
      [email, topics, state]
    )
  } catch (error) {
    console.error("subscribe: could not write", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "We could not save that just now. That one is ours." }, { status: 500 })
  }
  return NextResponse.json({ ok: true, email, topics })
}
