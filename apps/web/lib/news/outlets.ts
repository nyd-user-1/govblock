"use server"

import { q } from "@/lib/policy/db"

// The outlet behind a cited story (2026-09-13). A brief's citations carry only
// a title and the story's page here, /news/{state}/{id}, so the name and the
// domain of whoever published it have to come back from news_stories.

export type Outlet = { name: string | null; domain: string | null; url: string | null }

const host = (value: string | null) => {
  try {
    return value ? new URL(value).hostname.replace(/^www\./, "") : null
  } catch {
    return null
  }
}

/** Each story's outlet, keyed by story id. Unknown ids are simply absent. */
export async function outletsFor(ids: number[]): Promise<Record<number, Outlet>> {
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200)
  if (!clean.length) return {}
  try {
    const rows = await q<{ id: number | string; source_name: string | null; source_url: string | null; url: string | null }>(
      `select id, source_name, source_url, url from news_stories where id = any($1::bigint[])`,
      [`{${clean.join(",")}}`]
    )
    return Object.fromEntries(
      rows.map((r) => [Number(r.id), { name: r.source_name?.trim() || null, domain: host(r.url) ?? host(r.source_url), url: r.url }])
    )
  } catch (error) {
    console.error("news: outlets unavailable", error)
    return {}
  }
}
