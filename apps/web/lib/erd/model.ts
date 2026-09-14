// /erd — the policy database as a graph: every relation placed on a canvas,
// grouped by the domain it serves, with the links between them. The snapshot
// comes from scripts/erd/snapshot.mjs; everything here is derived from it and
// deterministic, so the client draws from coordinates and never measures.
//
// Only 20 foreign keys are declared in the database (the loaders write bare
// ids, LegiScan-style), so most links are inferred from column names: a
// bill_id anywhere means Bills, a people_id means People, and so on. The
// rules are in RULES below. Inferred links are drawn dashed.

import snapshot from "./schema.generated.json"

export type Column = { name: string; type: string; nullable: boolean; default: string | null }
type Relation = {
  schema: string
  name: string
  kind: "table" | "view" | "matview"
  rows: number | null
  bytes: number | null
  columns: Column[]
  pk: string[]
  uniques: string[][]
  fks: { name: string; columns: string[]; refSchema: string; refTable: string; refColumns: string[] }[]
}

export type Domain = { id: string; label: string; color: string }
export type Link = { id: string; from: string; fromColumn: string; to: string; toColumn: string; declared: boolean }
export type PlacedTable = {
  key: string
  schema: string
  name: string
  kind: Relation["kind"]
  rows: number | null
  bytes: number | null
  columns: Column[]
  pk: string[]
  domain: string
  x: number
  y: number
  w: number
  h: number
}
export type PlacedDomain = Domain & { x: number; y: number; w: number; h: number; count: number }
export type Graph = {
  generatedAt: string
  width: number
  height: number
  tables: PlacedTable[]
  links: Link[]
  domains: PlacedDomain[]
}

export const TABLE_W = 250
export const HEADER_H = 30
export const ROW_H = 17
export const FOOT_H = 6
const GAP_X = 44
const GAP_Y = 36
const DOMAIN_PAD = 32
const DOMAIN_LABEL = 36
const DOMAIN_GAP = 120
const ROW_MAX_W = 7000

// Colours: hue only, so light and dark both work (the canvas paints them at
// low alpha for the domain wash and full for the header stripe).
export const DOMAINS: Domain[] = [
  { id: "legiscan", label: "Bills, people, votes (LegiScan)", color: "#4f46e5" },
  { id: "congress", label: "Congress.gov", color: "#0284c7" },
  { id: "openstates", label: "Open States", color: "#0d9488" },
  { id: "lobbying", label: "Lobbying", color: "#b45309" },
  { id: "money", label: "Campaign finance (FEC, FollowTheMoney)", color: "#ca8a04" },
  { id: "ny-money", label: "New York budget, contracts, school aid", color: "#65a30d" },
  { id: "directory", label: "Congressional directory", color: "#7c3aed" },
  { id: "model-bills", label: "Model bills", color: "#c026d3" },
  { id: "news", label: "News and the desk", color: "#db2777" },
  { id: "readers", label: "Readers, accounts, API keys", color: "#dc2626" },
  { id: "chat", label: "Chat and consensus", color: "#ea580c" },
  { id: "watches", label: "Watches", color: "#059669" },
  { id: "workspace", label: "Workspace: forks, forms, assets", color: "#2563eb" },
  { id: "traffic", label: "Traffic (Amplify, Cloudflare)", color: "#64748b" },
  { id: "sheets", label: "Imported sheets", color: "#78716c" },
]

const EXCLUDED = /^pg_stat_statements/

function domainOf(t: Relation): string {
  const n = t.name
  if (t.schema === "openstates") return "openstates"
  if (/^congress_/.test(n)) return "congress"
  if (/^(Lobbying|lobby|Individual_Lobbyists|2025_lobbyist)/i.test(n)) return "lobbying"
  if (/^(Fec|Finance)/.test(n)) return "money"
  if (/^(ny_budget|budget_|Contracts|contracts|Discretionary|Revenue|school_funding)/.test(n)) return "ny-money"
  if (/^(house_offices|house_staff|senate_contact)$/.test(n)) return "directory"
  if (/^ModelBill/.test(n)) return "model-bills"
  if (/^(news_|mv_newsroom|mv_stream|blog_posts)/.test(n)) return "news"
  if (/^(readers|reader_profiles|profiles|sign_in_links|api_keys|api_usage|subscribers|Subscribers|user_|feedback|submitted_prompts|prompt_chat_counts|visitor_counts)/.test(n)) return "readers"
  if (/^(chat_|consensus_)/.test(n)) return "chat"
  if (/^watch/.test(n)) return "watches"
  if (/^(Forks|Commits|resource_documents|assets|Forms|Persona)$/.test(n)) return "workspace"
  if (/^(amplify_daily|cloudflare_)/.test(n)) return "traffic"
  if (/^(Sample Problems|Top 50 Public Policy Problems)$/.test(n)) return "sheets"
  return "legiscan"
}

// Where a column points when the database does not say. Each rule: a column
// name (or pattern), the tables it applies to, and the target `schema.table.column`.
type Rule = { column: RegExp; when?: (t: Relation) => boolean; to: string | ((t: Relation) => string | null) }
const not = (name: string) => (t: Relation) => t.name !== name
const RULES: Rule[] = [
  { column: /^(bill_id|legiscan_bill_id|sast_bill_id)$/, when: not("Bills"), to: "public.Bills.bill_id" },
  { column: /^(people_id|legiscan_people_id)$/, when: not("People"), to: "public.People.people_id" },
  { column: /^committee_id$/, when: (t) => /^Fec/.test(t.name) && t.name !== "FecCommittees", to: "public.FecCommittees.committee_id" },
  { column: /^(committee_id|pending_committee_id|sponsor_committee_id)$/, when: (t) => !/^Fec/.test(t.name) && t.name !== "Committees", to: "public.Committees.committee_id" },
  { column: /^roll_call_id$/, when: not("Roll Call"), to: "public.Roll Call.roll_call_id" },
  { column: /^document_id$/, when: (t) => t.name === "BillTextChunks", to: "public.BillTexts.document_id" },
  { column: /^document_id$/, when: (t) => t.name === "BillTexts" || t.name === "congress_text_formats", to: "public.Documents.document_id" },
  { column: /^bioguide_id$/, when: not("congress_members"), to: "public.congress_members.bioguide_id" },
  { column: /^(system_code|committee_code)$/, when: not("congress_committees"), to: "public.congress_committees.system_code" },
  { column: /^congress_key$/, to: "public.congress_bills.key" },
  { column: /^vote_identifier$/, to: "public.congress_house_votes.identifier" },
  {
    column: /^parent_key$/,
    to: (t) => {
      const parents: [RegExp, string][] = [
        [/^congress_amendment_/, "congress_amendments"],
        [/^congress_bill_/, "congress_bills"],
        [/^congress_nomination_/, "congress_nominations"],
        [/^congress_treaty_/, "congress_treaties"],
        [/^congress_committee_/, "congress_committees"],
        [/^congress_member_/, "congress_members"],
        [/^congress_requirement_/, "congress_house_requirements"],
      ]
      const hit = parents.find(([re]) => re.test(t.name))
      return hit ? `public.${hit[1]}.key` : null
    },
  },
  { column: /^user_id$/, when: not("readers"), to: "public.readers.id" },
  { column: /^watch_id$/, to: "public.watches.id" },
  { column: /^lobbyist_id$/, to: "public.lobbyists.id" },
  { column: /^model_id$/, when: not("ModelBills"), to: "public.ModelBills.model_id" },
  { column: /^filing_uuid$/, when: not("LobbyingFilings"), to: "public.LobbyingFilings.filing_uuid" },
  { column: /^office_id$/, to: "public.house_offices.id" },
  { column: /^prompt_id$/, to: "public.submitted_prompts.id" },
  { column: /^os_rc_id$/, when: not("roll_calls"), to: "openstates.roll_calls.os_rc_id" },
  { column: /^bill_key$/, when: (t) => t.schema === "openstates" && t.name !== "bills", to: "openstates.bills.bill_key" },
  { column: /^session$/, when: (t) => t.schema === "openstates" && t.name !== "session_map", to: "openstates.session_map.session" },
]

function splitTarget(target: string) {
  const [schema, ...rest] = target.split(".")
  const column = rest.pop()!
  return { schema, table: rest.join("."), column }
}

function inferLinks(relations: Relation[]): Link[] {
  const keys = new Set(relations.map((r) => `${r.schema}.${r.name}`))
  const links: Link[] = []
  const seen = new Set<string>()
  const push = (link: Link) => {
    const k = `${link.from}:${link.fromColumn}`
    if (seen.has(k) || !keys.has(link.to) || link.to === link.from) return
    seen.add(k)
    links.push(link)
  }
  for (const r of relations) {
    const from = `${r.schema}.${r.name}`
    for (const fk of r.fks) push({ id: fk.name, from, fromColumn: fk.columns[0], to: `${fk.refSchema}.${fk.refTable}`, toColumn: fk.refColumns[0], declared: true })
  }
  for (const r of relations) {
    if (r.kind !== "table") continue
    const from = `${r.schema}.${r.name}`
    for (const c of r.columns) {
      for (const rule of RULES) {
        if (!rule.column.test(c.name) || (rule.when && !rule.when(r))) continue
        const target = typeof rule.to === "function" ? rule.to(r) : rule.to
        if (!target) continue
        const to = splitTarget(target)
        push({ id: `${from}.${c.name}`, from, fromColumn: c.name, to: `${to.schema}.${to.table}`, toColumn: to.column, declared: false })
        break
      }
    }
  }
  return links
}

const height = (r: Relation) => HEADER_H + r.columns.length * ROW_H + FOOT_H

export function buildGraph(): Graph {
  const relations = (snapshot as { generatedAt: string; tables: Relation[] }).tables.filter((t) => !EXCLUDED.test(t.name))
  const links = inferLinks(relations)
  const inbound = new Map<string, number>()
  for (const l of links) inbound.set(l.to, (inbound.get(l.to) ?? 0) + 1)

  // Each domain packs its tables into columns, the hubs first so the table
  // everything points at sits top-left of its group.
  const placedDomains: PlacedDomain[] = []
  const placed: PlacedTable[] = []
  const blocks: { domain: Domain; tables: Relation[]; w: number; h: number; positions: { x: number; y: number }[] }[] = []
  for (const domain of DOMAINS) {
    const tables = relations
      .filter((r) => domainOf(r) === domain.id)
      .sort((a, b) => (inbound.get(`${b.schema}.${b.name}`) ?? 0) - (inbound.get(`${a.schema}.${a.name}`) ?? 0) || (b.rows ?? 0) - (a.rows ?? 0) || a.name.localeCompare(b.name))
    if (!tables.length) continue
    const cols = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(tables.length * 1.7))))
    const heights = new Array<number>(cols).fill(0)
    const positions = tables.map((t) => {
      const i = heights.indexOf(Math.min(...heights))
      const pos = { x: i * (TABLE_W + GAP_X), y: heights[i] }
      heights[i] += height(t) + GAP_Y
      return pos
    })
    const used = Math.min(cols, tables.length)
    blocks.push({ domain, tables, positions, w: used * (TABLE_W + GAP_X) - GAP_X + DOMAIN_PAD * 2, h: Math.max(...heights) - GAP_Y + DOMAIN_PAD * 2 + DOMAIN_LABEL })
  }

  // Domains flow left to right and wrap, like words on a line.
  let x = 0
  let y = 0
  let rowH = 0
  let width = 0
  for (const b of blocks) {
    if (x > 0 && x + b.w > ROW_MAX_W) {
      x = 0
      y += rowH + DOMAIN_GAP
      rowH = 0
    }
    placedDomains.push({ ...b.domain, x, y, w: b.w, h: b.h, count: b.tables.length })
    b.tables.forEach((t, i) => {
      placed.push({
        key: `${t.schema}.${t.name}`,
        schema: t.schema,
        name: t.name,
        kind: t.kind,
        rows: t.rows,
        bytes: t.bytes,
        columns: t.columns,
        pk: t.pk,
        domain: b.domain.id,
        x: x + DOMAIN_PAD + b.positions[i].x,
        y: y + DOMAIN_LABEL + DOMAIN_PAD + b.positions[i].y,
        w: TABLE_W,
        h: height(t),
      })
    })
    x += b.w + DOMAIN_GAP
    rowH = Math.max(rowH, b.h)
    width = Math.max(width, x - DOMAIN_GAP)
  }
  return { generatedAt: snapshot.generatedAt, width, height: y + rowH, tables: placed, links, domains: placedDomains }
}
