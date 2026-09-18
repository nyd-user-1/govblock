import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec } from "./chart-spec"

// Government forms (2026-09-17): the Forms harvest of 2026-08-30 alone —
// 392,182 PDFs catalogued from federal, New York State and New York City
// agencies, most of them opened and measured: pages, size, and whether the
// PDF has fields a person can type into. Where the copy came from is kept
// too: the agency's own server, or the Internet Archive.

const SLUG = "government-forms"
const SOURCE = "GovBlock's forms harvest, 2026-08-30: federal, New York State and New York City agencies."
const FIELDS = `jsonb_array_length(coalesce(fillable_fields, '[]'::jsonb))`
const GOV: Record<string, string> = { US: "Federal", NYS: "New York State", NYC: "New York City" }

// The agencies' short names as the harvest keyed them.
const AGENCY: Record<string, string> = {
  dolEta: "Labor: Employment & Training",
  dtf: "NYS Taxation & Finance",
  hud: "Housing & Urban Development",
  fns: "Food & Nutrition Service",
  sba: "Small Business Administration",
  gsa: "General Services Administration",
  cms: "Medicare & Medicaid Services",
  doh: "NYS Health",
  dol: "NYS Labor",
  hcr: "NYS Homes & Community Renewal",
  ocfs: "NYS Children & Family Services",
  nycHpd: "NYC Housing Preservation",
  nycHra: "NYC Human Resources",
  ed: "Education",
  oasas: "NYS Addiction Services",
  irs: "Internal Revenue Service",
}

export async function formsStudy() {
  const [govs, sources, pages, totals] = await Promise.all([
    q<{ gov: string; n: number; fetched: number; inspected: number; fillable: number; archive: number; live: number; failed: number; pages: number; avg_pages: number }>(`
      select gov, count(*)::int as n, count(*) filter (where status in ('fetched-live','fetched-archive'))::int as fetched, count(pages)::int as inspected,
             count(*) filter (where ${FIELDS} > 0)::int as fillable, count(*) filter (where status = 'fetched-archive')::int as archive,
             count(*) filter (where status = 'fetched-live')::int as live, count(*) filter (where status = 'failed')::int as failed,
             coalesce(sum(pages),0)::bigint as pages, avg(pages)::float as avg_pages
        from "Forms" group by 1 order by 2 desc`),
    q<{ gov: string; source: string; n: number; inspected: number; fillable: number; archive: number; live: number; failed: number; avg_pages: number; median_pages: number }>(`
      select gov, source, count(*)::int as n, count(pages)::int as inspected, count(*) filter (where ${FIELDS} > 0)::int as fillable,
             count(*) filter (where status = 'fetched-archive')::int as archive, count(*) filter (where status = 'fetched-live')::int as live,
             count(*) filter (where status = 'failed')::int as failed, avg(pages)::float as avg_pages,
             percentile_cont(0.5) within group (order by pages)::float as median_pages
        from "Forms" group by 1,2 order by 3 desc limit 14`),
    q<{ bucket: string; n: number }>(`
      select case when pages = 1 then '1' when pages = 2 then '2' when pages <= 5 then '3–5' when pages <= 10 then '6–10' when pages <= 25 then '11–25' when pages <= 100 then '26–100' else 'Over 100' end as bucket, count(*)::int as n
        from "Forms" where pages is not null group by 1`),
    q<{ total: number; hashed: number; distinct_files: number; median_pages: number }>(`
      select count(*)::int as total, count(sha256)::int as hashed, count(distinct sha256)::int as distinct_files, percentile_cont(0.5) within group (order by pages)::float as median_pages from "Forms"`),
  ])

  const t = totals[0]
  const sum = (key: "n" | "inspected" | "fillable" | "archive" | "live" | "failed" | "pages" | "fetched") => govs.reduce((a, g) => a + n(g[key]), 0)
  const order = ["1", "2", "3–5", "6–10", "11–25", "26–100", "Over 100"]
  const byAgency = sources.map((s) => ({
    gov: s.gov,
    key: s.source,
    name: AGENCY[s.source] ?? s.source,
    n: n(s.n),
    inspected: n(s.inspected),
    fillable: n(s.fillable),
    fillableShare: n(s.inspected) ? n(s.fillable) / n(s.inspected) : 0,
    archive: n(s.archive),
    live: n(s.live),
    failed: n(s.failed),
    archiveShare: n(s.n) ? n(s.archive) / n(s.n) : 0,
    avgPages: n(s.avg_pages),
    medianPages: n(s.median_pages),
  }))

  const charts: ChartSpec[] = [
    {
      id: "forms-fillable",
      report: SLUG,
      kind: "bar",
      title: "Share of an agency's PDFs a person can type into",
      source: `${SOURCE} PDFs opened and inspected; fillable means at least one form field.`,
      format: "pct",
      bars: [...byAgency].sort((a, b) => b.fillableShare - a.fillableShare).map((a) => ({ label: a.name, value: a.fillableShare, note: `${a.fillable.toLocaleString("en-US")} of ${a.inspected.toLocaleString("en-US")} inspected` })),
    },
    {
      id: "forms-copy",
      report: SLUG,
      kind: "stack",
      title: "Where the copy GovBlock holds came from",
      source: `${SOURCE} Every catalogued PDF, by where it was fetched from.`,
      series: ["The agency's own site", "The Internet Archive", "Not retrieved"],
      tones: ["one", "two", "muted"],
      rows: [...byAgency]
        .sort((a, b) => b.archiveShare - a.archiveShare)
        .slice(0, 10)
        .map((a) => ({ label: a.name, parts: [a.live, a.archive, a.failed + (a.n - a.live - a.archive - a.failed)] })),
    },
    {
      id: "forms-pages",
      report: SLUG,
      kind: "columns",
      title: "How long the PDFs are, in pages",
      source: `${SOURCE} PDFs opened and counted.`,
      format: "int",
      columns: order.map((b) => ({ label: b, value: n(pages.find((p) => p.bucket === b)?.n) })),
    },
  ]

  return {
    total: sum("n"),
    fetched: sum("fetched"),
    inspected: sum("inspected"),
    fillable: sum("fillable"),
    archive: sum("archive"),
    live: sum("live"),
    failed: sum("failed"),
    pages: sum("pages"),
    medianPages: n(t?.median_pages),
    hashed: n(t?.hashed),
    distinctFiles: n(t?.distinct_files),
    govs: govs.map((g) => ({ gov: g.gov, name: GOV[g.gov] ?? g.gov, n: n(g.n), inspected: n(g.inspected), fillable: n(g.fillable), archive: n(g.archive), live: n(g.live), failed: n(g.failed), pages: n(g.pages), avgPages: n(g.avg_pages) })),
    byAgency,
    charts,
  }
}
