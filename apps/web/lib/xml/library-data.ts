import "server-only"

import { fmtBill } from "@/lib/format"
import { q } from "@/lib/policy/db"
import { sessionYear, stateOfJurisdiction } from "@/lib/typeset/expression-document"
import { billWork, resolveSlash } from "@/lib/xml/address"
import { FAMILIES, familyBySlug, inFamily, type Family } from "@/lib/xml/families"
import { JURISDICTION_NAMES, jurisdictionName, jurisdictionSlug, libraryHref, librarySegments, prefixLabel, workHref } from "@/lib/xml/library"

// The library's reads (window 4, 2026-09-14). The top level (families,
// jurisdictions, a jurisdiction's codes and sessions, a family's codes) comes
// from the catalogue in `xml_library` (sql/012), kept in memory for an hour;
// the Works inside a code, a constitution, a session or a family come live
// from `expressions` through the index on the address's code segment. Federal
// bills join a family through Congress's policy areas.
//
// A path under /workspace/typeset/library:
//
//   (nothing)                     every family and every jurisdiction
//   agricultural-law              a family's codes in every jurisdiction (?j=us-ar for one; ?show=sections for its sections)
//   arkansas-agricultural-law     the same family in one jurisdiction, its sections first
//   us-ny                         a jurisdiction: its constitution, codes, sessions, families
//   us-ny/code/agm                a code's sections
//   us-ny/const                   a constitution's sections
//   us-ny/bill/2025               a session's bills
//   new-york-code, 119            what the `/` command names, redirected to its path

export type CatalogueRow = {
  prefix: string
  jurisdiction: string
  kind: "bill" | "usc" | "code" | "const"
  unit: string
  name: string | null
  works: number
  expressions: number
  coverage: number | null
  latest: string | null
}

export type LibrarySort = "address" | "newest" | "coverage"
export type LibraryShow = "all" | "sections" | "codes" | "bills" | "sessions"
export type LibraryQuery = { sort: LibrarySort; q: string; j: string | null; show: LibraryShow; offset: number }

export type LibraryCrumb = { label: string; href?: string }
export type FolderItem = { key: string; href: string; name: string; detail: string | null; jurisdiction: string | null; works: number; coverage: number | null; latest: string | null }
export type WorkItem = { work: string; href: string; label: string; detail: string | null; jurisdiction: string; date: string | null; coverage: number | null }

export type Listing = {
  /** The path under the library, "" for its root. */
  path: string
  title: string
  crumbs: LibraryCrumb[]
  groups: { key: string; label: string | null; folders: FolderItem[] }[]
  works: WorkItem[] | null
  /** Works under this library before the text filter; null when not known. */
  total: number | null
  offset: number
  more: boolean
  /** The views a library offers; the first is its default. */
  shows: { value: LibraryShow; label: string }[]
  jurisdictions: { value: string; label: string }[] | null
  sorts: LibrarySort[]
  /** Why a view or a sort did not apply. */
  note: string | null
  query: LibraryQuery
}

export type Resolved = { redirect: string } | { listing: Listing } | null

export const PAGE = 100
const HOUR = 60 * 60 * 1000
const JURISDICTION = /^us(?:-[a-z]{2})?$/
const SEGMENT = /^[A-Za-z0-9.-]+$/
const SORTS: LibrarySort[] = ["address", "newest", "coverage"]
const SHOWS: LibraryShow[] = ["all", "sections", "codes", "bills", "sessions"]
/** The most codes a family's sections are merged across in one statement. */
const MERGED_CODES = 120

export function readLibraryQuery(sp: URLSearchParams): LibraryQuery {
  const sort = sp.get("sort") as LibrarySort
  const show = sp.get("show") as LibraryShow
  const j = sp.get("j")
  return {
    sort: SORTS.includes(sort) ? sort : "address",
    q: (sp.get("q") ?? "").trim().slice(0, 80),
    j: j && JURISDICTION.test(j) ? j : null,
    show: SHOWS.includes(show) ? show : "all",
    offset: Math.min(Math.max(Number(sp.get("offset")) || 0, 0), 5000),
  }
}

// ------------------------------------------------------------- catalogue ---

let catalogue: { rows: CatalogueRow[]; at: number } | null = null
let loading: Promise<CatalogueRow[]> | null = null

/** Every row of `xml_library`, a page at a time under the Data API's megabyte. */
export async function loadCatalogue(): Promise<CatalogueRow[]> {
  if (catalogue && Date.now() - catalogue.at < HOUR) return catalogue.rows
  loading ??= (async () => {
    const rows: CatalogueRow[] = []
    let after = ""
    for (;;) {
      const page = await q<CatalogueRow>(
        `select prefix, jurisdiction, kind, unit, name, works, expressions, coverage, latest_date::text as latest from xml_library where prefix > $1 order by prefix limit 4000`,
        [after]
      )
      for (const r of page) rows.push({ ...r, works: Number(r.works), expressions: Number(r.expressions), coverage: r.coverage === null ? null : Number(r.coverage) })
      if (page.length < 4000) break
      after = page[page.length - 1].prefix
    }
    catalogue = { rows, at: Date.now() }
    return rows
  })().finally(() => {
    loading = null
  })
  return loading
}

const isCode = (r: CatalogueRow) => r.kind === "code" || r.kind === "usc"

/** The codes a family holds, in one jurisdiction or all. */
function familyCodes(rows: CatalogueRow[], family: Family, jurisdiction: string | null) {
  return rows.filter((r) => isCode(r) && (!jurisdiction || r.jurisdiction === jurisdiction) && inFamily(family, { jurisdiction: r.jurisdiction, kind: r.kind, code: r.unit, name: r.name }))
}

const weighted = (rows: CatalogueRow[]) => {
  const n = rows.reduce((s, r) => s + (r.coverage === null ? 0 : r.expressions), 0)
  return n ? rows.reduce((s, r) => s + (r.coverage ?? 0) * r.expressions, 0) / n : null
}
const latestOf = (rows: CatalogueRow[]) => rows.reduce<string | null>((m, r) => (r.latest && (!m || r.latest > m) ? r.latest : m), null)
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

/** "1-2-111" after "1-2-20": digit runs compared as numbers. */
const naturalKey = (s: string) => s.replace(/\d+/g, (d) => d.padStart(12, "0"))

const codeName = (r: CatalogueRow) => (r.kind === "bill" || r.kind === "usc" || r.kind === "const" ? prefixLabel(r.prefix, r.name) : r.name || r.unit.toUpperCase())

function folderOf(r: CatalogueRow): FolderItem {
  return { key: r.prefix, href: libraryHref(r.prefix), name: codeName(r), detail: r.kind === "code" ? r.unit.toUpperCase() : null, jurisdiction: r.jurisdiction, works: r.works, coverage: r.coverage, latest: r.latest }
}

function sortFolders(folders: FolderItem[], sort: LibrarySort, address: (f: FolderItem) => string) {
  const out = [...folders]
  if (sort === "newest") out.sort((a, b) => (b.latest ?? "").localeCompare(a.latest ?? "") || a.name.localeCompare(b.name))
  else if (sort === "coverage") out.sort((a, b) => (a.coverage ?? 2) - (b.coverage ?? 2) || a.name.localeCompare(b.name))
  else out.sort((a, b) => address(a).localeCompare(address(b)))
  return out
}

const matches = (text: string | null | undefined, filter: string) => !filter || (text ?? "").toLowerCase().includes(filter.toLowerCase())

// ------------------------------------------------------------------ works ---

const NATURAL = (column: string) => `array(select lpad(m[1], 12, '0') || m[2] from regexp_matches(${column}, '(\\d*)(\\D*)', 'g') as m)`
const ORDER: Record<LibrarySort, string> = {
  address: NATURAL("w.work"),
  newest: "w.date desc, w.work",
  coverage: "w.coverage asc nulls last, w.work",
}
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
const textArray = (xs: string[]) => `{${[...new Set(xs)].map((x) => `"${x.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`
/** A filter that reads as a bill number ("A21", "hr 6644", "6644") filters by the address; anything else searches titles. */
const isNumberFilter = (s: string) => /^[a-z]{0,6}[\s.-]*\d[\w.-]*$/i.test(s.trim())

type WorkRow = { work: string; label: string | null; date: string | null; coverage: number | null }
type BillRow = { bill_id: number; state: string; session_id: number; session_title: string | null; bill_number: string; title: string | null; date: string | null }

const workItem = (r: WorkRow, jurisdiction: string, detail: string | null = null): WorkItem => ({
  work: r.work,
  href: workHref(r.work),
  label: r.label ?? r.work,
  detail,
  jurisdiction,
  date: r.date,
  coverage: r.coverage === null ? null : Number(r.coverage),
})

const LEGISCAN: Record<string, string> = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }

/** Bill titles for a page of a session's Works, from "Bills" by the numbers the addresses carry, zero-padded as the legislature pads them. */
async function billTitles(row: CatalogueRow, works: string[]): Promise<Map<string, string>> {
  const state = stateOfJurisdiction(row.jurisdiction)
  const year = sessionYear(row.jurisdiction, row.unit)
  const byNumber = new Map<string, string>()
  const variants: string[] = []
  for (const work of works) {
    const [, , , , type, number] = work.split("/")
    if (!type || !number) continue
    const letters = row.jurisdiction === "us" ? (LEGISCAN[type] ?? type.toUpperCase()) : type.toUpperCase()
    const key = `${letters}${number.toUpperCase()}`
    byNumber.set(key, work)
    if (/^\d+$/.test(number)) for (let width = number.length; width <= 6; width++) variants.push(`${letters}${number.padStart(width, "0")}`)
    else variants.push(key)
  }
  if (!variants.length || !year) return new Map()
  const rows = await q<{ bill_number: string; title: string | null }>(
    `select bill_number, max(title) as title from "Bills" where state = $1 and session_id = $2 and bill_number = any($3::text[]) group by 1`,
    [state, year, textArray(variants)]
  ).catch(() => [])
  const out = new Map<string, string>()
  for (const r of rows) {
    const key = r.bill_number.toUpperCase().replace(/^([A-Z]+)0*/, "$1")
    if (r.title && byNumber.has(key)) out.set(byNumber.get(key)!, r.title)
  }
  return out
}

/** Bills as Works: their addresses, and the coverage of each one's latest stored Expression. */
async function billWorks(bills: BillRow[], within: string | null): Promise<WorkItem[]> {
  const addressed = bills.flatMap((b) => {
    const work = billWork({ ...b, special: /special|extraordinary/i.test(b.session_title ?? "") })
    return work && (!within || work.startsWith(`${within}/`)) ? [{ b, work }] : []
  })
  const stored = addressed.length
    ? await q<{ work: string; coverage: number | null }>(`select distinct on (work) work, coverage from expressions where work = any($1::text[]) order by work, expression_date desc`, [textArray(addressed.map((a) => a.work))])
    : []
  const coverage = new Map(stored.map((r) => [r.work, r.coverage === null ? null : Number(r.coverage)]))
  return addressed.map(({ b, work }) => ({ work, href: workHref(work), label: fmtBill(b.bill_number, b.state), detail: b.title, jurisdiction: work.split("/")[1], date: b.date, coverage: coverage.get(work) ?? null }))
}

/** A session's bills whose titles hold the words. */
async function sessionBillsByTitle(row: CatalogueRow, query: LibraryQuery): Promise<{ works: WorkItem[]; more: boolean }> {
  const order = query.sort === "address" ? "bill_number" : query.sort === "newest" ? "last_action_date desc nulls last, bill_id desc" : "last_action_date desc nulls last, bill_id desc"
  const bills = await q<BillRow>(
    `select bill_id, state, session_id, session_title, bill_number, title, last_action_date::text as date from "Bills"
      where state = $1 and session_id = $2 and title ilike $3 order by ${order} limit ${PAGE + 1} offset ${query.offset}`,
    [stateOfJurisdiction(row.jurisdiction), sessionYear(row.jurisdiction, row.unit), like(query.q)]
  )
  return { works: await billWorks(bills.slice(0, PAGE), row.prefix), more: bills.length > PAGE }
}

/** The Works under one catalogue row: a code's sections, a constitution's, a session's bills. */
async function worksOf(row: CatalogueRow, query: LibraryQuery): Promise<{ works: WorkItem[]; more: boolean }> {
  if (row.kind === "bill" && query.q && !isNumberFilter(query.q)) return sessionBillsByTitle(row, query)
  const params: unknown[] = [row.jurisdiction]
  let where: string
  if (row.kind === "bill") {
    params.push(row.unit)
    where = `jurisdiction = $1 and kind = 'bill' and session = $2`
  } else if (row.kind === "const") {
    where = `jurisdiction = $1 and kind = 'statute' and split_part(work, '/', 3) = 'const'`
  } else {
    params.push(row.unit, row.kind)
    where = `jurisdiction = $1 and kind = 'statute' and split_part(work, '/', 4) = $2 and split_part(work, '/', 3) = $3`
  }
  if (query.q) {
    params.push(like(query.q.replace(/\s+/g, "")), like(query.q))
    where += ` and (replace(label, ' ', '') ilike $${params.length - 1} or work ilike $${params.length})`
  }
  const rows = await q<WorkRow>(
    `select work, label, date, coverage from (
       select distinct on (work) work, label, expression_date::text as date, coverage from expressions where ${where} order by work, expression_date desc
     ) w order by ${ORDER[query.sort]} limit ${PAGE + 1} offset ${query.offset}`,
    params
  )
  const page = rows.slice(0, PAGE)
  const titles = row.kind === "bill" ? await billTitles(row, page.map((r) => r.work)) : new Map<string, string>()
  const works = page.map((r) => {
    const item = workItem(r, row.jurisdiction, titles.get(r.work) ?? null)
    if (row.kind === "bill" && r.label) item.label = fmtBill(r.label, stateOfJurisdiction(row.jurisdiction))
    return item
  })
  return { works, more: rows.length > PAGE }
}

/** A section's jurisdiction and code, which tell a family's sections apart. */
const sectionDetail = (codes: Map<string, CatalogueRow>) => (work: string) => {
  const [, jurisdiction, kind, unit] = work.split("/")
  const code = codes.get(`/${jurisdiction}/${kind}/${unit}`)
  return code ? `${jurisdictionName(jurisdiction)} · ${codeName(code)}` : jurisdictionName(jurisdiction)
}

/**
 * A family's sections across its codes: a limited read per code, each from the
 * index on the code segment, merged and sorted. A family of more codes than one
 * statement merges lists its sections a jurisdiction at a time.
 */
async function familySections(codes: CatalogueRow[], query: LibraryQuery, scoped: boolean): Promise<{ works: WorkItem[]; more: boolean; note: string | null }> {
  const safe = codes.filter((c) => SEGMENT.test(c.unit) && JURISDICTION.test(c.jurisdiction))
  if (!safe.length) return { works: [], more: false, note: null }
  const detail = sectionDetail(new Map(safe.map((c) => [c.prefix, c])))
  const quoted = (s: string) => `'${s.replace(/'/g, "''")}'`
  const filter = query.q ? ` and (label ilike ${quoted(like(query.q))} or work ilike ${quoted(like(query.q))})` : ""
  let rows: WorkRow[]
  if (safe.length <= MERGED_CODES) {
    const reach = query.offset + PAGE + 1
    const inner = query.sort === "newest" ? "expression_date desc, work" : query.sort === "coverage" ? "coverage asc nulls last, work" : NATURAL("work")
    const outer = query.sort === "address" ? `split_part(w.work, '/', 2), split_part(w.work, '/', 4), ${NATURAL("w.work")}` : ORDER[query.sort]
    const parts = safe.map(
      (c) =>
        `(select work, label, expression_date::text as date, coverage from expressions
           where jurisdiction = ${quoted(c.jurisdiction)} and kind = 'statute' and split_part(work, '/', 4) = ${quoted(c.unit)} and split_part(work, '/', 3) = ${quoted(c.kind)}${filter}
           order by ${inner} limit ${reach})`
    )
    rows = await q<WorkRow>(`select * from (${parts.join(" union all ")}) w order by ${outer} limit ${PAGE + 1} offset ${query.offset}`)
  } else if (!scoped) {
    return { works: [], more: false, note: `A family of ${plural(safe.length, "code")} lists its sections one jurisdiction at a time.` }
  } else {
    rows = await q<WorkRow>(
      `select work, label, expression_date::text as date, coverage from expressions
        where jurisdiction = any($1::text[]) and kind = 'statute' and split_part(work, '/', 4) = any($2::text[])
          and ('/' || jurisdiction || '/' || split_part(work, '/', 3) || '/' || split_part(work, '/', 4)) = any($3::text[])${filter}
        order by jurisdiction, split_part(work, '/', 4), work limit ${PAGE + 1} offset ${query.offset}`,
      [textArray(safe.map((c) => c.jurisdiction)), textArray(safe.map((c) => c.unit)), textArray(safe.map((c) => c.prefix))]
    )
  }
  const page = rows.slice(0, PAGE)
  const note = safe.length > MERGED_CODES && query.sort !== "address" ? `Sorted by address: a family of ${plural(safe.length, "code")} sorts by date and coverage inside one code.` : null
  return { works: page.map((r) => workItem(r, r.work.split("/")[1], detail(r.work))), more: rows.length > PAGE, note }
}

/** Federal bills a family takes by Congress's policy areas. */
async function familyBills(family: Family, query: LibraryQuery): Promise<{ works: WorkItem[]; more: boolean }> {
  if (!family.policyAreas?.length) return { works: [], more: false }
  const params: unknown[] = [textArray(family.policyAreas)]
  let filter = ""
  if (query.q) {
    params.push(like(query.q))
    filter = ` and (b.bill_number ilike $2 or b.title ilike $2)`
  }
  const order = query.sort === "address" ? "b.session_id desc, b.bill_number" : "b.last_action_date desc nulls last, b.bill_id desc"
  const bills = await q<BillRow>(
    `select b.bill_id, b.state, b.session_id, b.session_title, b.bill_number, b.title, b.last_action_date::text as date
       from congress_bill_subjects s join "Bills" b on b.bill_id = s.bill_id
      where s.is_policy_area and s.name = any($1::text[])${filter}
      order by ${order} limit ${PAGE + 1} offset ${query.offset}`,
    params
  )
  return { works: await billWorks(bills.slice(0, PAGE), null), more: bills.length > PAGE }
}

// --------------------------------------------------------------- listings ---

const ROOT_CRUMB: LibraryCrumb = { label: "Library", href: libraryHref() }

const base = (path: string, title: string, crumbs: LibraryCrumb[], query: LibraryQuery): Listing => ({
  path,
  title,
  crumbs: [ROOT_CRUMB, ...crumbs],
  groups: [],
  works: null,
  total: null,
  offset: query.offset,
  more: false,
  shows: [],
  jurisdictions: null,
  sorts: SORTS,
  note: null,
  query,
})

function rootListing(rows: CatalogueRow[], query: LibraryQuery): Listing {
  const listing = base("", "Library", [], query)
  listing.crumbs = [{ label: "Library" }]
  const families = FAMILIES.map((family): FolderItem => {
    const codes = familyCodes(rows, family, null)
    const places = new Set(codes.map((c) => c.jurisdiction)).size
    return { key: family.slug, href: libraryHref(family.slug), name: family.name, detail: `${plural(places, "jurisdiction")} · ${plural(codes.length, "code")}`, jurisdiction: null, works: codes.reduce((s, c) => s + c.works, 0), coverage: weighted(codes), latest: latestOf(codes) }
  }).filter((f) => matches(f.name, query.q))
  const byPlace = new Map<string, CatalogueRow[]>()
  for (const r of rows) byPlace.set(r.jurisdiction, [...(byPlace.get(r.jurisdiction) ?? []), r])
  const places = [...byPlace.entries()]
    .map(([jurisdiction, rs]): FolderItem => {
      const codes = rs.filter((r) => r.kind !== "bill").length
      const sessions = rs.length - codes
      return { key: jurisdiction, href: libraryHref(jurisdiction), name: jurisdictionName(jurisdiction), detail: `${plural(codes, "code")} · ${plural(sessions, "session")}`, jurisdiction, works: rs.reduce((s, r) => s + r.works, 0), coverage: weighted(rs), latest: latestOf(rs) }
    })
    .filter((f) => matches(f.name, query.q))
  listing.groups = [
    { key: "families", label: "Families", folders: sortFolders(families, query.sort, (f) => f.name) },
    { key: "jurisdictions", label: "Jurisdictions", folders: sortFolders(places, query.sort, (f) => (f.jurisdiction === "us" ? "" : f.name)) },
  ]
  return listing
}

function jurisdictionListing(rows: CatalogueRow[], jurisdiction: string, show: LibraryShow, query: LibraryQuery): Listing {
  const name = jurisdictionName(jurisdiction)
  const listing = base(jurisdiction, name, [{ label: name }], query)
  const mine = rows.filter((r) => r.jurisdiction === jurisdiction)
  const pick = (kinds: CatalogueRow["kind"][]) => mine.filter((r) => kinds.includes(r.kind)).map(folderOf).filter((f) => matches(f.name, query.q) || matches(f.detail, query.q))
  const families = FAMILIES.map((family) => ({ family, codes: familyCodes(rows, family, jurisdiction) }))
    .filter((f) => f.codes.length)
    .map(({ family, codes }): FolderItem => ({ key: family.slug, href: libraryHref(`${jurisdictionSlug(jurisdiction)}-${family.slug}`), name: family.name, detail: plural(codes.length, "code"), jurisdiction: null, works: codes.reduce((s, c) => s + c.works, 0), coverage: weighted(codes), latest: latestOf(codes) }))
    .filter((f) => matches(f.name, query.q))
  listing.shows = [
    { value: "all", label: "All" },
    { value: "codes", label: "Codes" },
    { value: "sessions", label: "Sessions" },
  ]
  listing.query = { ...query, show }
  const groups: Listing["groups"] = []
  if (show === "all" || show === "codes") {
    const constitution = pick(["const"])
    if (constitution.length) groups.push({ key: "const", label: null, folders: constitution })
    groups.push({ key: "codes", label: jurisdiction === "us" ? "United States Code" : "Codes", folders: sortFolders(pick(["code", "usc"]), query.sort, (f) => naturalKey(f.key)) })
  }
  if (show === "all" || show === "sessions") {
    const sessions = sortFolders(pick(["bill"]), query.sort, (f) => naturalKey(f.key))
    if (query.sort === "address") sessions.reverse()
    groups.push({ key: "sessions", label: "Sessions", folders: sessions })
  }
  if (show === "all" && families.length) groups.push({ key: "families", label: "Families", folders: sortFolders(families, query.sort, (f) => f.name) })
  listing.groups = groups.filter((g) => g.folders.length)
  return listing
}

async function prefixListing(row: CatalogueRow, query: LibraryQuery): Promise<Listing> {
  const name = codeName(row)
  const place = jurisdictionName(row.jurisdiction)
  const title = row.kind === "bill" || name.startsWith(place) ? name : `${place} ${name}`
  const listing = base(row.prefix.slice(1), title, [{ label: place, href: libraryHref(row.jurisdiction) }, { label: name }], query)
  const { works, more } = await worksOf(row, query)
  listing.works = works
  listing.more = more
  listing.total = row.works
  return listing
}

async function familyListing(rows: CatalogueRow[], family: Family, fixed: string | null, query: LibraryQuery): Promise<Listing> {
  const jurisdiction = fixed ?? query.j
  const path = fixed ? `${jurisdictionSlug(fixed)}-${family.slug}` : family.slug
  const crumbs: LibraryCrumb[] = jurisdiction ? [{ label: family.name, href: libraryHref(family.slug) }, { label: jurisdictionName(jurisdiction) }] : [{ label: family.name }]
  const listing = base(path, jurisdiction ? `${jurisdictionName(jurisdiction)} ${family.name}` : family.name, crumbs, query)
  const codes = familyCodes(rows, family, jurisdiction)
  const billsHere = Boolean(family.policyAreas?.length) && (!jurisdiction || jurisdiction === "us")
  // A family across every jurisdiction opens on its codes; in one jurisdiction, on its sections.
  const sections = { value: "sections" as const, label: "Sections" }
  const codesView = { value: "codes" as const, label: "Codes" }
  listing.shows = [...(jurisdiction ? [sections, codesView] : [codesView, sections]), ...(billsHere ? [{ value: "bills" as const, label: "Bills of Congress" }] : [])]
  if (!fixed) {
    const places = [...new Set(familyCodes(rows, family, null).map((c) => c.jurisdiction))]
    listing.jurisdictions = places.map((j) => ({ value: j, label: jurisdictionName(j) })).sort((a, b) => (a.value === "us" ? -1 : b.value === "us" ? 1 : a.label.localeCompare(b.label)))
  }
  const show = listing.shows.some((s) => s.value === query.show) ? query.show : listing.shows[0].value
  listing.query = { ...query, show, j: fixed ? null : jurisdiction }
  if (show === "codes") {
    const folders = codes.map((c) => ({ ...folderOf(c), detail: jurisdictionName(c.jurisdiction) })).filter((f) => matches(f.name, query.q) || matches(f.detail, query.q))
    listing.groups = [{ key: "codes", label: null, folders: sortFolders(folders, query.sort, (f) => `${f.jurisdiction === "us" ? "" : f.detail} ${naturalKey(f.key)}`) }]
    listing.total = codes.reduce((s, c) => s + c.works, 0)
    return listing
  }
  if (show === "bills") {
    const { works, more } = await familyBills(family, query)
    listing.works = works
    listing.more = more
    return listing
  }
  const { works, more, note } = await familySections(codes, query, Boolean(jurisdiction))
  listing.works = works
  listing.more = more
  listing.note = note
  listing.total = codes.reduce((s, c) => s + c.works, 0)
  return listing
}

/** A family named with a jurisdiction in front: "arkansas-agricultural-law". */
function jurisdictionFamily(slug: string): { jurisdiction: string; family: Family } | null {
  for (const family of FAMILIES) {
    if (!slug.endsWith(`-${family.slug}`)) continue
    const place = slug.slice(0, -family.slug.length - 1)
    const jurisdiction = Object.keys(JURISDICTION_NAMES).find((j) => jurisdictionSlug(j) === place || j === place)
    if (jurisdiction) return { jurisdiction, family }
  }
  return null
}

/** What a library path names, as a listing, a redirect to where it lives, or nothing. */
export async function resolveLibrary(segments: string[], query: LibraryQuery): Promise<Resolved> {
  const parts = librarySegments(segments)
  const rows = await loadCatalogue()
  if (!parts.length) return { listing: rootListing(rows, query) }
  const [head, kind, unit, ...rest] = parts

  if (!JURISDICTION.test(head)) {
    if (parts.length > 1) return null
    const family = familyBySlug(head)
    if (family) return { listing: await familyListing(rows, family, null, query) }
    const scoped = jurisdictionFamily(head)
    if (scoped) return { listing: await familyListing(rows, scoped.family, scoped.jurisdiction, query) }
    const target = resolveSlash(head)
    if (target?.kind === "prefix") return { redirect: libraryHref(target.prefix) }
    if (target?.kind === "address") return { redirect: workHref(target.address.workAddress) }
    const place = Object.keys(JURISDICTION_NAMES).find((j) => jurisdictionSlug(j) === head)
    return place ? { redirect: libraryHref(place) } : null
  }

  if (!rows.some((r) => r.jurisdiction === head)) return null
  if (!kind) return { listing: jurisdictionListing(rows, head, query.show === "codes" || query.show === "sessions" ? query.show : "all", query) }
  if (!unit) {
    if (kind === "const") {
      const row = rows.find((r) => r.prefix === `/${head}/const`)
      return row ? { listing: await prefixListing(row, query) } : null
    }
    if (kind === "code" || kind === "usc") return { listing: { ...jurisdictionListing(rows, head, "codes", query), path: `${head}/${kind}` } }
    if (kind === "bill") return { listing: { ...jurisdictionListing(rows, head, "sessions", query), path: `${head}/${kind}` } }
    return null
  }
  // Below a constitution, or below a code or a session, is a Work: the XML view.
  if (kind === "const") return { redirect: workHref(`/${parts.join("/")}`) }
  const row = rows.find((r) => r.prefix === `/${head}/${kind}/${unit}`)
  if (!row) return null
  if (rest.length) return { redirect: workHref(`/${parts.join("/")}`) }
  return { listing: await prefixListing(row, query) }
}

export { codeName, familyCodes, jurisdictionFamily }

/** The page title for a path, without reading anything. */
export function libraryTitle(segments: string[]): string {
  const [head, kind, unit] = librarySegments(segments)
  if (!head) return "Library"
  const family = familyBySlug(head)
  if (family) return family.name
  const scoped = jurisdictionFamily(head)
  if (scoped) return `${jurisdictionName(scoped.jurisdiction)} ${scoped.family.name}`
  if (JURISDICTION.test(head)) return kind ? prefixLabel(`/${[head, kind, unit].filter(Boolean).join("/")}`) : jurisdictionName(head)
  return "Library"
}
