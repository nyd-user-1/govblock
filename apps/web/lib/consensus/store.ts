import "server-only"

import { q } from "@/lib/policy/db"
import type { Conversation, Statement } from "@/lib/consensus/data"

// The conversations, from Aurora (Brendan, 2026-09-11: "move it to aurora").
// Two tables: consensus_conversations, one row each in the order the index
// lists them, and consensus_statements, a row per statement with its votes
// and its per-group tallies as JSON. The eight rooms CompDem published were
// the first rows; a conversation of our own goes in the same way.

type ConversationRow = { slug: string; title: string; topic: string | null; description: string | null; source: string | null; stats: Conversation["stats"] | string; groups: Conversation["groups"] | string }
type StatementRow = { slug: string; tid: number; text: string; moderated: number; votes: Statement["votes"] | string; by_group: Statement["byGroup"] | string }

const json = <T,>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v)

const statement = (r: StatementRow): Statement => ({ tid: Number(r.tid), text: r.text, moderated: Number(r.moderated), votes: json(r.votes), byGroup: json(r.by_group) })

async function load(where: string, params: unknown[]): Promise<Conversation[]> {
  try {
    const rows = await q<ConversationRow>(`select slug, title, topic, description, source, stats, groups from consensus_conversations ${where} order by position`, params)
    if (!rows.length) return []
    const statements = await q<StatementRow>(`select slug, tid, text, moderated, votes, by_group from consensus_statements where slug = any($1::text[]) order by slug, tid`, [`{${rows.map((r) => `"${r.slug}"`).join(",")}}`])
    const bySlug = new Map<string, Statement[]>()
    for (const s of statements) bySlug.set(s.slug, [...(bySlug.get(s.slug) ?? []), statement(s)])
    return rows.map((r) => ({ slug: r.slug, title: r.title, topic: r.topic ?? "", description: r.description ?? "", source: r.source, stats: json(r.stats), groups: json(r.groups), statements: bySlug.get(r.slug) ?? [] }))
  } catch (error) {
    console.error("consensus: unavailable", error)
    return []
  }
}

/** Every conversation, in the index's order, each with its statements. */
export const conversations = () => load("", [])

/** One conversation by slug, or null. */
export const conversation = async (slug: string) => (slug ? ((await load("where slug = $1", [slug]))[0] ?? null) : null)
