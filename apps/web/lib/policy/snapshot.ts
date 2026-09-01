import * as F from "@/lib/fixtures"
import members from "@/lib/data/members-us.json"
import rollcalls from "@/lib/data/rollcalls-us.json"
import hearings from "@/lib/data/hearings-us.json"
import texts from "@/lib/data/texts-us.json"
import textBodies from "@/lib/data/text-bodies-us.json"
import fecCandidates from "@/lib/data/fec-candidates-us.json"
import fecManifest from "@/lib/data/fec-manifest.json"

// What livingston-v3's /api/policy/* and /api/fec/* answered for Congress on
// 2026-09-01, answered here from lib/data instead. The boards still ask by
// URL, so when the lake is wired in only this file changes.

type FecRow = (typeof fecCandidates)["2026"]["rows"][number]
const PARTY = (party: string | null) => {
  const p = (party ?? "").toUpperCase()
  return p.startsWith("DEM") ? "DEM" : p.startsWith("REP") ? "REP" : "OTHER"
}

export function resolve(url: string): unknown {
  const { pathname, searchParams: q } = new URL(url, "http://snapshot")
  const limit = Number(q.get("limit") ?? 0)
  switch (pathname) {
    case "/api/policy/committees":
      return F.committeesAll
    case "/api/policy/members":
      return members
    case "/api/policy/rollcalls":
      return rollcalls
    case "/api/policy/hearings": {
      const from = q.get("from") ?? "0000", to = q.get("to") ?? "9999"
      const rows = hearings.filter((h) => h.date >= from && h.date <= to)
      return limit ? rows.slice(0, limit) : rows
    }
    case "/api/policy/texts":
      return limit ? texts.slice(0, limit) : texts
    case "/api/policy/text": {
      const text = (textBodies as Record<string, string>)[q.get("document") ?? ""]
      return { texts: [], text: text ?? null }
    }
    case "/api/fec/manifest":
      return fecManifest
    case "/api/fec/candidates": {
      const cycle = q.get("cycle") ?? "2026"
      const snapshot = (fecCandidates as Record<string, (typeof fecCandidates)["2026"]>)[cycle] ?? fecCandidates["2026"]
      const office = q.get("office") ?? "", party = q.get("party") ?? "", ici = q.get("ici") ?? ""
      const sort = (q.get("sort") ?? "receipts") as keyof FecRow, dir = q.get("dir") === "asc" ? 1 : -1
      const offset = Number(q.get("offset") ?? 0), page = Number(q.get("limit") ?? 25)
      const rows = (cycle in fecCandidates ? snapshot.rows : [])
        .filter((r) => (!office || r.office === office) && (!party || PARTY(r.party) === party) && (!ici || r.ici === ici))
        .sort((a, b) => (a[sort] > b[sort] ? dir : a[sort] < b[sort] ? -dir : 0))
      return {
        meta: { ...snapshot.meta, cycle: Number(cycle), office, party, ici, sort, dir: dir > 0 ? "asc" : "desc", offset, matched: rows.length, returned: Math.min(page, rows.length - offset) },
        rows: rows.slice(offset, offset + page),
      }
    }
    default:
      return undefined
  }
}
