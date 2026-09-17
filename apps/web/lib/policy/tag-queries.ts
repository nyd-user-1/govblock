import { TAGS, termsFor, type Tag } from "@/lib/data/tags"
import { n, q } from "@/lib/policy/db"
import { getSubjectTerms, type Resolved } from "@/lib/policy/db-queries"

// What a GovBlock tag holds, in a given jurisdiction (2026-09-16). A tag is our
// word for a subject; the record files bills under its own terms, so a tag is
// resolved to the terms it gathers and then counted over those. The terms are
// read once per jurisdiction and matched here, so adding a tag costs no query.

export type TagCount = { slug: string; name: string; blurb: string; bills: number; recent: number; firstSeen: string }

/** Every term this jurisdiction files bills under. */
async function termNames(f: Resolved) {
  const terms = await getSubjectTerms(f)
  return [...terms.policyAreas, ...terms.subjects].map((t) => t.name)
}

/** The source terms each tag gathers here, tags with none dropped. */
async function resolveTags(f: Resolved): Promise<{ tag: Tag; terms: string[] }[]> {
  const names = await termNames(f)
  // A tag that gathers by title alone (Artificial Intelligence) stands even
  // where the record has no term for it.
  return TAGS.map((tag) => ({ tag, terms: termsFor(tag, names) })).filter((row) => row.terms.length > 0 || row.tag.title?.length)
}

/** The bills a tag's own title patterns gather, by slug. */
const TITLE_SQL = `select p.slug, b.bill_id, b.last_action_date, b.status_date
     from unnest($3::text[], $4::text[]) as p(slug, pat)
     join "Bills" b on b.state = $1 and b.session_id = $2 and b.title ~* p.pat`

// Three numbers per tag in one pass: how many bills carry it, how many moved in
// the last thirty days, and when the first of them was filed.
const COUNT_SQL = (state: string) =>
  state === "US"
    ? `select m.slug, count(distinct cs.bill_id)::int bills,
              count(distinct cs.bill_id) filter (where b.last_action_date >= to_char(current_date - 30, 'YYYY-MM-DD'))::int recent,
              min(coalesce(cb.introduced_date, b.status_date, b.last_action_date)) first_seen
         from unnest($3::text[], $4::text[]) as m(slug, name)
         join congress_bill_subjects cs on cs.name = m.name
         join "Bills" b on b.bill_id = cs.bill_id and b.state = $1 and b.session_id = $2
         left join congress_bills cb on cb.bill_id = b.bill_id
        group by 1`
    : `select m.slug, count(distinct sj.bill_id)::int bills,
              count(distinct sj.bill_id) filter (where b.last_action_date >= to_char(current_date - 30, 'YYYY-MM-DD'))::int recent,
              min(coalesce(b.status_date, b.last_action_date)) first_seen
         from unnest($3::text[], $4::text[]) as m(slug, name)
         join "Subjects" sj on sj.subject = m.name
         join "Bills" b on b.bill_id = sj.bill_id and b.state = $1 and b.session_id = $2
        group by 1`

/** Every tag with bills behind it here, in name order. */
export async function getTagIndex(f: Resolved): Promise<TagCount[]> {
  const resolved = await resolveTags(f)
  if (!resolved.length) return []
  const slugs: string[] = []
  const names: string[] = []
  for (const { tag, terms } of resolved)
    for (const term of terms) {
      slugs.push(tag.slug)
      names.push(term)
    }
  const titled = TAGS.filter((t) => t.title?.length)
  const [rows, byTitle] = await Promise.all([
    q<{ slug: string; bills: number; recent: number; first_seen: string | null }>(COUNT_SQL(f.state), [f.state, f.session, slugs, names]),
    titled.length
      ? q<{ slug: string; bills: number; recent: number; first_seen: string | null }>(
          `with hits as (${TITLE_SQL})
           select slug, count(distinct bill_id)::int bills,
                  count(distinct bill_id) filter (where last_action_date >= to_char(current_date - 30, 'YYYY-MM-DD'))::int recent,
                  min(coalesce(status_date, last_action_date)) first_seen
             from hits group by 1`,
          [f.state, f.session, titled.flatMap((t) => t.title!.map(() => t.slug)), titled.flatMap((t) => t.title!)]
        ).catch(() => [])
      : Promise.resolve([]),
  ])
  const counts = new Map(rows.map((r) => [r.slug, r]))
  // A tag with title patterns takes the larger of the two counts rather than
  // their sum: a bill can be caught by both and must be counted once.
  for (const r of byTitle) {
    const prior = counts.get(r.slug)
    counts.set(r.slug, {
      slug: r.slug,
      bills: Math.max(n(prior?.bills), n(r.bills)),
      recent: Math.max(n(prior?.recent), n(r.recent)),
      first_seen: [prior?.first_seen, r.first_seen].filter(Boolean).sort()[0] ?? null,
    })
  }
  return resolved
    .map(({ tag }) => {
      const row = counts.get(tag.slug)
      return { slug: tag.slug, name: tag.name, blurb: tag.blurb, bills: n(row?.bills), recent: n(row?.recent), firstSeen: row?.first_seen ?? "" }
    })
    .filter((t) => t.bills > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type TagBill = {
  bill_id: number
  bill_number: string
  title: string
  status_desc: string | null
  last_action: string | null
  last_action_date: string | null
  sponsor: string | null
}

/** One tag here: the terms it gathers, how many bills carry them, and a page of those bills. */
export async function getTagBills(f: Resolved, slug: string, limit = 24, offset = 0) {
  const resolved = await resolveTags(f)
  const found = resolved.find((row) => row.tag.slug === slug)
  if (!found) return null
  const byTerm =
    f.state === "US"
      ? `exists (select 1 from congress_bill_subjects cs where cs.bill_id = b.bill_id and cs.name = any($3::text[]))`
      : `exists (select 1 from "Subjects" sj where sj.bill_id = b.bill_id and sj.subject = any($3::text[]))`
  const titles = found.tag.title ?? []
  const where = titles.length ? `(${byTerm} or exists (select 1 from unnest($4::text[]) as p(pat) where b.title ~* p.pat))` : byTerm
  const params = titles.length ? [f.state, f.session, found.terms, titles] : [f.state, f.session, found.terms]
  const [rows, total] = await Promise.all([
    q<TagBill>(
      `select b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date,
              (select p.name from "Sponsors" s join "People" p using (people_id) where s.bill_id = b.bill_id and s.sponsor_type_id = 1 order by s.position limit 1) sponsor
         from "Bills" b
        where b.state = $1 and b.session_id = $2 and ${where}
        order by b.last_action_date desc nulls last, b.bill_id desc
        limit ${Math.min(Math.max(1, limit), 100)} offset ${Math.max(0, offset)}`,
      params
    ),
    q<{ bills: number }>(`select count(*)::int bills from "Bills" b where b.state = $1 and b.session_id = $2 and ${where}`, params),
  ])
  return {
    tag: found.tag,
    terms: found.terms,
    bills: rows.map((r) => ({ ...r, bill_id: n(r.bill_id) })),
    total: n(total[0]?.bills),
  }
}
