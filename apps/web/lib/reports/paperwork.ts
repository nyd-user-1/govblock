import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec } from "./chart-spec"

// The paperwork wall (2026-09-18), research recipe report #6.
//
// 1. Question: what does a New Yorker applying for help have to fill in:
//    how many pages, in how many versions, and how many of them can be typed
//    into?
// 2. Coverage: the forms harvest of 2026-08-30, federal, New York State and
//    New York City agencies.
// 3–4. Gather and classify: each program's own application, found by its form
//    number in the title or file name (APPLICATIONS below); every language
//    and format version counts as a copy. Programs are also measured broadly,
//    every form whose title or file names the program (PROGRAMS).
// 5. Verify: each application's number, pages and fields read from the PDFs
//    the harvest opened.
// Gaps: New York takes some of these applications online; this report
//    measures the paper forms.

const SLUG = "paperwork-wall"
const FIELDS = `jsonb_array_length(coalesce(fillable_fields, '[]'::jsonb))`
const HAY = `coalesce(title, '') || ' ' || regexp_replace(coalesce(s3_key, ''), '^.*/', '')`

export const APPLICATIONS = [
  { form: "LDSS-2921", program: "Cash assistance, SNAP, Medicaid and services (combined)", agency: "NYS OTDA", rx: "ldss.?2921" },
  { form: "DOH-4220", program: "Medicaid and state health coverage", agency: "NYS Department of Health", rx: "doh.?4220" },
  { form: "LDSS-4826", program: "SNAP (food stamps)", agency: "NYS OTDA", rx: "ldss.?4826" },
  { form: "LDSS-3421", program: "Home Energy Assistance (HEAP)", agency: "NYS OTDA", rx: "ldss.?3421" },
  { form: "OCFS-LDSS-4699", program: "Child care assistance", agency: "NYS OCFS", rx: "ldss.?4699" },
  { form: "LDSS-4726", program: "TANF services", agency: "NYS OTDA", rx: "ldss.?4726" },
  { form: "SSA-8000", program: "Supplemental Security Income (SSI)", agency: "Social Security Administration", rx: "ssa.?8000" },
]

export const PROGRAMS = [
  { key: "Medicaid", rx: "medicaid|medical assistance|child health plus|essential plan" },
  { key: "SNAP", rx: "\\mSNAP\\M|food stamp|supplemental nutrition|food assistance" },
  { key: "Unemployment insurance", rx: "unemployment|\\mUI\\M claim" },
  { key: "Housing and energy help", rx: "section 8|housing choice voucher|rental assistance|\\mSCRIE\\M|\\mDRIE\\M|public housing|\\mHEAP\\M|home energy assistance" },
  { key: "Cash assistance", rx: "cash assistance|public assistance|temporary assistance|\\mTANF\\M|family assistance|safety net" },
  { key: "Disability (SSI)", rx: "\\mSSI\\M|supplemental security income|disability (benefits|insurance)" },
]

export async function paperworkStudy() {
  const [apps, programs] = await Promise.all([
    Promise.all(
      APPLICATIONS.map((a) =>
        q<{ file: string; gov: string; pages: number | null; fields: number; status: string }>(
          `select regexp_replace(s3_key, '^.*/', '') as file, gov, pages, ${FIELDS} as fields, status
             from "Forms" where status in ('fetched-live','fetched-archive') and (${HAY}) ~* $1`,
          [a.rx]
        )
      )
    ),
    Promise.all(
      PROGRAMS.map((p) =>
        q<{ n: number; fillable: number; pages: number; archive: number }>(
          `select count(*)::int as n, count(*) filter (where ${FIELDS} > 0)::int as fillable, coalesce(sum(pages), 0)::int as pages,
                  count(*) filter (where status = 'fetched-archive')::int as archive
             from "Forms" where status in ('fetched-live','fetched-archive') and gov in ('NYS','NYC','US') and (${HAY}) ~* $1`,
          [p.rx]
        )
      )
    ),
  ])

  const applications = APPLICATIONS.map((a, i) => {
    const copies = apps[i]
    // The standard version's length: the most common page count among the
    // copies that are not large print.
    const standard = copies.filter((c) => !/[-_]lp\b|[-_]lp\./i.test(c.file) && n(c.pages) > 2).map((c) => n(c.pages))
    const counts = new Map<number, number>()
    for (const p of standard) counts.set(p, (counts.get(p) ?? 0) + 1)
    const pages = [...counts].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0]?.[0] ?? 0
    return {
      ...a,
      copies: copies.length,
      fillable: copies.filter((c) => n(c.fields) > 0).length,
      archive: copies.filter((c) => c.status === "fetched-archive").length,
      pages,
      longest: Math.max(0, ...copies.map((c) => n(c.pages))),
    }
  })

  const byProgram = PROGRAMS.map((p, i) => ({ program: p.key, n: n(programs[i][0]?.n), fillable: n(programs[i][0]?.fillable), pages: n(programs[i][0]?.pages), archive: n(programs[i][0]?.archive) }))

  const charts: ChartSpec[] = [
    {
      id: "paperwork-applications",
      report: SLUG,
      kind: "bar",
      title: "Pages in the standard application for each program",
      source: "GovBlock's forms harvest, 2026-08-30: each program's own application, its most common English page count.",
      format: "int",
      bars: applications.map((a) => ({ label: `${a.form}: ${a.program}`, value: a.pages, note: `${a.copies} versions, ${a.fillable} fillable` })),
    },
  ]

  return { applications, byProgram, charts }
}
