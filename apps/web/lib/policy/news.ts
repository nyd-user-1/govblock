import { hasDatabase, n, one, q } from "@/lib/policy/db"

// The press on a jurisdiction's government: news_stories, seeded from the
// news APIs by scripts/news/seed.mjs (2026-09-09), one row per story keyed by
// its URL. Read by the /news desks, the article page, and the newsroom's
// "In the press" column. A missing table or a paused cluster reads as no
// stories, never as a broken page.

export type NewsStory = {
  id: number
  state: string
  url: string
  title: string
  description: string | null
  content: string | null
  image_url: string | null
  author: string | null
  source_api: string
  source_name: string | null
  source_url: string | null
  published_at: string | null
  fetched_at: string
}

const COLUMNS =
  "id, state, url, title, description, content, image_url, author, source_api, source_name, source_url, published_at, fetched_at"

export async function getStories(
  state: string,
  { limit = 60, query }: { limit?: number; query?: string } = {}
): Promise<NewsStory[]> {
  if (!hasDatabase()) return []
  try {
    const like = query?.trim() ? `%${query.trim()}%` : null
    return await q<NewsStory>(
      `select ${COLUMNS} from news_stories
       where state = $1 and ($3::text is null or title ilike $3 or description ilike $3)
       order by published_at desc nulls last, id desc
       limit $2`,
      [state.toUpperCase(), Math.min(Math.max(limit, 1), 500), like]
    )
  } catch (error) {
    console.error("news: stories unavailable", error)
    return []
  }
}

export async function getStory(id: number): Promise<NewsStory | null> {
  if (!hasDatabase() || !Number.isFinite(id) || id <= 0) return null
  try {
    return await one<NewsStory>(
      `select ${COLUMNS} from news_stories where id = $1`,
      [id]
    )
  } catch (error) {
    console.error("news: story unavailable", error)
    return null
  }
}

/** Stories on file per jurisdiction, for the desks index. */
export async function getStoryCounts(): Promise<Record<string, number>> {
  if (!hasDatabase()) return {}
  try {
    const rows = await q<{ state: string; count: unknown }>(
      `select state, count(*) as count from news_stories group by state`
    )
    return Object.fromEntries(rows.map((r) => [r.state, n(r.count)]))
  } catch (error) {
    console.error("news: counts unavailable", error)
    return {}
  }
}

// ---- briefs -------------------------------------------------------------------
//
// news_briefs holds every brief the site shows in one shape: Exa's daily
// national one, pulled by scripts/news/briefs.mjs or pushed by the monitor's
// webhook (scope "states", author "exa"), and the Reporter's per-desk ones
// (scope = the postal code, author "reporter"). `content` is a lede and cited
// bullets; `[n]` in it is grounding[0].citations[n-1].

/**
 * Where a phrase brief lives: "NY:open-primaries", or "ALL:open-primaries"
 * for the same phrase across every desk. The same phrase on the same desk on
 * the same day is the brief already written, so the model runs once.
 */
export function phraseScope(state: string, phrase: string) {
  const slug = phrase
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return slug ? `${state.toUpperCase()}:${slug}` : null
}

export type Citation = { title: string; url: string }
export type NewsBrief = {
  id: number
  scope: string
  author: "exa" | "reporter" | string
  run_id: string | null
  title: string | null
  content: string
  grounding: { field: string; confidence: string; citations: Citation[] }[]
  results: unknown[]
  model: string | null
  usd: number | null
  completed_at: string
}

const BRIEF_COLUMNS =
  "id, scope, author, run_id, title, content, grounding, results, model, usd, completed_at"

const parseBrief = (row: Record<string, unknown>): NewsBrief => ({
  ...(row as NewsBrief),
  grounding:
    typeof row.grounding === "string"
      ? JSON.parse(row.grounding)
      : ((row.grounding as NewsBrief["grounding"]) ?? []),
  results:
    typeof row.results === "string"
      ? JSON.parse(row.results)
      : ((row.results as unknown[]) ?? []),
  usd: row.usd == null ? null : Number(row.usd),
})

export async function getBriefs(
  scope: string,
  limit = 7
): Promise<NewsBrief[]> {
  if (!hasDatabase()) return []
  try {
    const rows = await q(
      `select ${BRIEF_COLUMNS} from news_briefs where scope = $1 order by completed_at desc limit $2`,
      [scope, limit]
    )
    return rows.map(parseBrief)
  } catch (error) {
    console.error("news: briefs unavailable", error)
    return []
  }
}

/**
 * The phrase briefs already written for a desk — the newest of each phrase,
 * and the across-the-states ones beside them, since those belong to no desk.
 * A desk's own daily brief has a bare scope and is not one of these.
 */
export async function getPhraseBriefs(
  state: string,
  limit = 12
): Promise<NewsBrief[]> {
  if (!hasDatabase()) return []
  try {
    const rows = await q(
      `select distinct on (scope) ${BRIEF_COLUMNS} from news_briefs
       where author = 'reporter' and (scope like $1 or scope like 'ALL:%')
       order by scope, completed_at desc`,
      [`${state.toUpperCase()}:%`]
    )
    return rows
      .map(parseBrief)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
      .slice(0, limit)
  } catch (error) {
    console.error("news: phrase briefs unavailable", error)
    return []
  }
}

export async function getLatestBrief(scope: string): Promise<NewsBrief | null> {
  return (await getBriefs(scope, 1))[0] ?? null
}

/** The brief written today for a scope, if one was — the Reporter writes at most one a day. */
export async function getTodaysBrief(scope: string): Promise<NewsBrief | null> {
  const latest = await getLatestBrief(scope)
  return latest &&
    latest.completed_at.slice(0, 10) === new Date().toISOString().slice(0, 10)
    ? latest
    : null
}

export async function saveBrief(brief: {
  scope: string
  author: string
  run_id?: string | null
  monitor_id?: string | null
  title: string | null
  content: string
  grounding: NewsBrief["grounding"]
  results: unknown[]
  model?: string | null
  usd?: number | null
}): Promise<NewsBrief | null> {
  if (!hasDatabase()) return null
  const rows = await q(
    `insert into news_briefs (scope, author, run_id, monitor_id, title, content, grounding, results, model, usd)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
     on conflict (run_id) do update set content = excluded.content, grounding = excluded.grounding, results = excluded.results
     returning ${BRIEF_COLUMNS}`,
    [
      brief.scope,
      brief.author,
      brief.run_id ?? null,
      brief.monitor_id ?? null,
      brief.title,
      brief.content,
      JSON.stringify(brief.grounding),
      JSON.stringify(brief.results),
      brief.model ?? null,
      brief.usd ?? null,
    ]
  )
  return rows[0] ? parseBrief(rows[0]) : null
}
