import "server-only"

import { n, q, qTuned } from "@/lib/policy/db"
import { billNumberMatch, BODY, CHUNK_FIRST, CHUNK_LEN, CHUNK_STRIDE, CURRENT, HEADLINE_OPTS, SINCE } from "@/lib/policy/db-queries"

// The national search (Brendan, 2026-09-18): bills, law and legislators across
// all fifty states, DC and Congress in one question, answered in three groups.
// No free tool asks all three at once; that is the point of it.
//
// What the measurements of 2026-09-18 decided (docs/prompts/2026-09-18-national-search.md):
//
// - Bills are searched in the current sessions first — title and number, then
//   the full text — and widened to every session on file only when that finds
//   fewer rows than the group holds. A common word fills the group from the
//   current sessions alone, and across every session there is no ranking
//   worth paying for: "tax" matches 564,357 documents.
// - Law puts sections whose heading carries the words first, the shortest
//   (most specific) headings first, then fills the group with sections whose
//   text matches. Ranking the text across every jurisdiction took 33 s cold
//   for "tax"; with one jurisdiction chosen it takes 4 s at worst (California),
//   so relevance is offered there and code order is the default.
// - Legislators are the ⌘K menu's rule, by name and alias, sitting first.
//
// Bills and law run through qTuned — 64 MB of work_mem, which keeps a common
// word's bitmap exact, and an 8 s deadline, after which a group reports a
// timeout instead of holding the other two.

export type Jurisdiction = string | null
export type Source = "bills" | "law" | "legislators"
export type LawSort = "code" | "relevance"

export type NationalBill = {
  bill_id: number
  bill_number: string
  title: string
  status_desc: string | null
  last_action: string | null
  last_action_date: string | null
  committee: string | null
  body: string | null
  state: string
  /** The matching passage of the bill's text, « » around the words; null for a title or number match. */
  snippet: string | null
}

export type NationalLaw = {
  state: string
  law_id: string
  law_name: string
  location_id: string
  doc_type: string
  title: string | null
  snippet: string
  /** 0: the heading carries the words; 1: the text does. */
  tier: number
}

export type NationalLegislator = {
  people_id: number
  name: string
  party: string
  role: string
  chamber: string
  district: string
  state: string
  photo_url: string | null
  bioguide_id: string | null
  active: boolean
}

export type Group<T> = { rows: T[]; error?: "timeout" | "failed" }

export type NationalResult = {
  q: string
  j: Jurisdiction
  sort: LawSort
  bills: (Group<NationalBill> & { widened: boolean }) | null
  law: Group<NationalLaw> | null
  legislators: Group<NationalLegislator> | null
}

const SECTIONS = `('SECTION', 'PREAMBLE', 'JOINT_RULE', 'RULE')`

/** The words a heading or title has to carry: three letters or more (the trigram index needs three), no excluded words, no connectives. */
function wordsOf(term: string) {
  return term
    .split(/\s+/)
    .filter((w) => w && !w.startsWith("-"))
    .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((w) => w.length >= 3 && !/^(and|or|the)$/i.test(w))
    .slice(0, 4)
}

const failure = (error: unknown): "timeout" | "failed" => (/statement timeout|canceling statement/i.test(String((error as Error)?.message ?? error)) ? "timeout" : "failed")

async function settle<T>(run: () => Promise<T[]>): Promise<Group<T>> {
  try {
    return { rows: await run() }
  } catch (error) {
    console.error("national search group failed", String((error as Error)?.message ?? error))
    return { rows: [], error: failure(error) }
  }
}

// ---------------------------------------------------------------------------
// Bills

const BILL_COLUMNS = `b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date, b.committee, b.body, b.state`

/** Bills whose number or title carries the term, newest first; exact numbers before everything. */
function billTitles(term: string, j: Jurisdiction, current: boolean, limit: number) {
  const words = wordsOf(term)
  const number = billNumberMatch(term)
  if (!words.length && !number.numbered) return Promise.resolve([] as NationalBill[])
  const params: unknown[] = []
  const p = (value: unknown) => `$${params.push(value)}`
  const exact = number.numbered ? `((b.state = 'US' and b.bill_number ~* ${p(number.exactUs)}) or (b.state <> 'US' and b.bill_number ~* ${p(number.exactStates)}))` : "false"
  const matches = [
    exact,
    number.numbered ? `b.bill_number ilike ${p(number.numberLike)}` : null,
    words.length ? `(${words.map((w) => `b.title ilike ${p(`%${w}%`)}`).join(" and ")})` : null,
  ].filter(Boolean)
  const scope = j ? `b.state = ${p(j)}` : "true"
  return qTuned<NationalBill & { exact: boolean }>(
    // "as materialized", as searchAll learned: inlined, the planner joins the
    // session view first and re-derives the trigram bitmap once per jurisdiction.
    `with hits as materialized (
       select ${BILL_COLUMNS}, b.session_id, ${exact} as exact
       from "Bills" b
       where ${scope} ${current ? `and b.session_id >= ${SINCE}` : ""}
         and (${matches.join(" or ")})
     )
     select h.bill_id, h.bill_number, h.title, h.status_desc, h.last_action, h.last_action_date, h.committee, h.body, h.state,
            null::text as snippet, h.exact
     from hits h ${current ? `join ${CURRENT} c on c.state = h.state and c.session_id = h.session_id` : ""}
     order by h.exact desc, h.last_action_date desc nulls last, h.bill_id desc
     limit ${p(limit)}`,
    params
  )
}

/**
 * Bills whose text carries the term, newest first, each with its passage. The
 * current sessions go jurisdiction by jurisdiction, because the scope index
 * cuts state, session and the words together; every session goes through the
 * plain index on the words. Both read "BillTextChunks" for the part of a long
 * document past its first megabyte — see searchAll for the geometry.
 */
function billTexts(term: string, j: Jurisdiction, current: boolean, limit: number) {
  const params: unknown[] = [term, HEADLINE_OPTS, limit, limit + 12]
  const scope = (alias: string, value: string) => (j ? `${alias}.state = ${value}` : "true")
  if (j) params.push(j)
  const J = "$5"
  const matched = current
    ? `scopes as (
         select c.state, c.session_id from ${CURRENT} c where ${scope("c", J)}
       ),
       picked as (
         select x.* from scopes s
         cross join lateral (
           select distinct on (u.bill_id) u.bill_id, u.document_id, u.head_from
           from (
             select t.bill_id, t.document_id, 1 as head_from
             from "BillTexts" t
             where t.state = s.state and t.session_id = s.session_id and t.text is not null
               and t.search_tsv @@ websearch_to_tsquery('english', $1)
             union all
             select c.bill_id, c.document_id, ${CHUNK_FIRST} + c.chunk_no * ${CHUNK_STRIDE}
             from "BillTextChunks" c
             where c.state = s.state and c.session_id = s.session_id
               and c.tsv @@ websearch_to_tsquery('english', $1)
           ) u
           order by u.bill_id desc, u.document_id desc, u.head_from
           limit $4
         ) x
       )`
    : `matches as materialized (
         select t.bill_id, t.document_id, 1 as head_from
         from "BillTexts" t
         where ${scope("t", J)} and t.text is not null and t.search_tsv @@ websearch_to_tsquery('english', $1)
         union all
         select c.bill_id, c.document_id, ${CHUNK_FIRST} + c.chunk_no * ${CHUNK_STRIDE}
         from "BillTextChunks" c
         where ${scope("c", J)} and c.tsv @@ websearch_to_tsquery('english', $1)
       ),
       -- The newest 500 by bill id before they meet "Bills": a word common in
       -- earlier sessions would otherwise join hundreds of thousands of rows.
       picked as (
         select distinct on (bill_id) bill_id, document_id, head_from
         from matches order by bill_id desc, document_id desc, head_from
         limit 500
       )`
  return qTuned<NationalBill>(
    `with ${matched},
     shortlist as (
       select p.*, b.last_action_date from picked p join "Bills" b on b.bill_id = p.bill_id
       order by b.last_action_date desc nulls last, p.bill_id desc
       limit $4
     ),
     snippets as (
       select ${BILL_COLUMNS},
              ts_headline('english',
                case when p.head_from <= 1 then left(${BODY}, 200000) else substr(t.text, p.head_from, ${CHUNK_LEN}) end,
                websearch_to_tsquery('english', $1), $2) as snippet
       from shortlist p
       join "Bills" b on b.bill_id = p.bill_id
       join "BillTexts" t on t.document_id = p.document_id
     )
     -- A headline that found no match in its window is the document's opening,
     -- which reads as a result and says nothing; it is dropped, as in searchAll.
     select * from snippets where snippet like '%«%'
     order by last_action_date desc nulls last, bill_id desc
     limit $3`,
    params
  )
}

async function bills(term: string, j: Jurisdiction, limit: number): Promise<Group<NationalBill> & { widened: boolean }> {
  const merge = (lists: NationalBill[][]) => {
    const seen = new Set<number>()
    const out: NationalBill[] = []
    for (const list of lists) {
      for (const row of list) {
        const id = n(row.bill_id)
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ ...row, bill_id: id })
      }
    }
    return out.slice(0, limit)
  }
  const now = await Promise.all([settle(() => billTitles(term, j, true, limit)), settle(() => billTexts(term, j, true, limit))])
  let rows = merge(now.map((g) => g.rows))
  let error = now.find((g) => g.error)?.error
  let widened = false
  if (rows.length < limit && !error) {
    const then = await Promise.all([settle(() => billTitles(term, j, false, limit)), settle(() => billTexts(term, j, false, limit))])
    const more = merge([rows, ...then.map((g) => g.rows)])
    widened = more.length > rows.length
    rows = more
    error = then.find((g) => g.error)?.error
  }
  return { rows: rows.map(({ exact: _exact, ...row }: NationalBill & { exact?: unknown }) => row), widened, ...(error && !rows.length ? { error } : {}) }
}

// ---------------------------------------------------------------------------
// Law

function law(term: string, j: Jurisdiction, sort: LawSort, limit: number) {
  const words = wordsOf(term)
  const params: unknown[] = [term, HEADLINE_OPTS, limit]
  const p = (value: unknown) => `$${params.push(value)}`
  const scope = j ? `l.state = ${p(j)}` : "true"
  const heads = words.length
    ? `select l.state, l.law_id, l.law_name, l.location_id, l.doc_type, l.title, 0 as tier,
              row_number() over (order by (l.title ilike ${p(`%${words.join(" ")}%`)}) desc, length(l.title), l.state, l.law_id, l.sequence_no) as ord
       from "Laws" l
       where ${scope} and l.doc_type in ${SECTIONS} and not coalesce(l.repealed, false)
         and ${words.map((w) => `l.title ilike ${p(`%${w}%`)}`).join(" and ")}`
    : `select null::text state, null::text law_id, null::text law_name, null::text location_id, null::text doc_type, null::text title, 0 as tier, 0::bigint as ord where false`
  // Across every jurisdiction the text matches come in the order the index
  // hands them over, which is what keeps "tax" to a second; with one chosen,
  // code order, or relevance when the reader asks for it.
  const relevance = !!j && sort === "relevance"
  const bodyOrder = !j ? "" : relevance ? "order by k desc" : "order by law_id, sequence_no"
  return qTuned<NationalLaw>(
    `with query as (select websearch_to_tsquery('english', $1) as query),
     heads as materialized (${heads}),
     top_heads as (select * from heads order by ord limit $3),
     body as (
       select l.state, l.law_id, l.law_name, l.location_id, l.doc_type, l.title, 1 as tier,
              row_number() over (${bodyOrder}) as ord
       from (
         select l.state, l.law_id, l.law_name, l.location_id, l.doc_type, l.title, l.sequence_no,
                ${relevance ? "ts_rank_cd(l.tsv, query)" : "0::real"} as k
         from "Laws" l, query
         where ${scope} and l.tsv @@ query and l.doc_type in ${SECTIONS} and not coalesce(l.repealed, false)
           and not exists (select 1 from top_heads h where h.state = l.state and h.law_id = l.law_id and h.location_id = l.location_id)
         ${bodyOrder}
         limit $3
       ) l
     ),
     chosen as (
       select * from top_heads
       union all
       select * from body
       order by tier, ord
       limit $3
     )
     select c.state, c.law_id, c.law_name, c.location_id, c.doc_type, c.title, c.tier,
            ts_headline('english', coalesce(l.text, ''), query.query, $2) as snippet
     from chosen c
     join "Laws" l on l.state = c.state and l.law_id = c.law_id and l.location_id = c.location_id
     cross join query
     order by c.tier, c.ord`,
    params
  )
}

// ---------------------------------------------------------------------------
// Legislators

function legislators(term: string, j: Jurisdiction, limit: number) {
  // Word by word, in the name or the aliases, as searchAll does: word order and
  // a middle name the reader never knew both stop mattering.
  const tokens = term.split(/\s+/).filter(Boolean).slice(0, 4)
  if (!tokens.length) return Promise.resolve([] as NationalLegislator[])
  const params: unknown[] = []
  const p = (value: unknown) => `$${params.push(value)}`
  return q<NationalLegislator>(
    `select p.people_id, p.name, p.party, p.role, p.chamber, p.district, p.state, p.photo_url, p.bioguide_id,
            exists (select 1 from "SessionPeople" sp where sp.people_id = p.people_id) as active
     from "People" p
     where p.committee_id is null and not coalesce(p.archived, false)
       and coalesce(p.first_name, '') <> '' and coalesce(p.last_name, '') <> ''
       and p.role in ('Rep', 'Sen')
       ${j ? `and p.state = ${p(j)}` : ""}
       and ${tokens.map((t) => { const x = p(`%${t}%`); return `(p.name ilike ${x} or p.aliases ilike ${x})` }).join(" and ")}
     order by active desc, p.last_name, p.first_name
     limit ${p(limit)}`,
    params
  ).then((rows) => rows.map((r) => ({ ...r, people_id: n(r.people_id) })))
}

// ---------------------------------------------------------------------------

export async function nationalSearch({ term, j, only, sort, limit = 8 }: { term: string; j: Jurisdiction; only: Source | null; sort: LawSort; limit?: number }): Promise<NationalResult> {
  const asked = (source: Source) => !only || only === source
  // Relevance needs one jurisdiction; across all of them it is the 33 s case.
  const lawSort: LawSort = j ? sort : "code"
  const [b, l, m] = await Promise.all([
    asked("bills") ? bills(term, j, limit) : null,
    asked("law") ? settle(() => law(term, j, lawSort, limit)) : null,
    asked("legislators") ? settle(() => legislators(term, j, limit)) : null,
  ])
  return { q: term, j, sort: lawSort, bills: b, law: l, legislators: m }
}
