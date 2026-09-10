import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { STATE_NAMES, stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { DATASET_FAMILIES } from "@/lib/policy/api-catalog"
import { congressName } from "@/lib/policy/congress"
import { getDatasetCounts, getSessionsWithTitles } from "@/lib/policy/db-queries"
import { CommandBlock } from "@/components/command-block"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { JURISDICTIONS } from "@/components/library/jurisdiction-index"
import { H2, Table } from "@/components/typeset"

// One jurisdiction's datasets: a section per session, and under it every
// family as JSON or CSV, each a whole-session file from the bulk route
// (Brendan, 2026-09-05: "dataset/new-york/2025/bills"). Cached hourly.

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

const HOST = "https://policy.nysgpt.com"

const sessionName = (state: string, session: number, title: string | null) =>
  state === "US" ? congressName(session) : (title ?? "").replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim() || String(session)

async function load(param: string) {
  const state = param.toUpperCase()
  if (!STATE_NAMES[state] || !JURISDICTIONS.some((j) => j.code === state)) return null
  const sessions = await getSessionsWithTitles(state).catch(() => [])
  if (!sessions.length) return null
  const counts = await getDatasetCounts(state).catch(() => null)
  return {
    state,
    counts,
    sessions: sessions.map((r) => ({ year: Number(r.session_id), bills: Number(r.bills ?? 0), name: sessionName(state, Number(r.session_id), r.title ?? null) })),
  }
}

type Props = { params: Promise<{ state: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params
  const data = await load(state)
  if (!data) return { title: "Bulk Datasets" }
  const name = data.state === "US" ? "U.S. Congress" : stateName(data.state)
  return { title: `${name} datasets`, description: `Every session of the ${name} record as files: bills, sponsors, members, committees, roll calls, votes and history.` }
}

export default async function DatasetsJurisdictionPage({ params }: Props) {
  const { state: param } = await params
  const data = await load(param)
  if (!data) notFound()
  const { state, sessions, counts } = data
  const rowsOf = (family: string, year: number) => counts?.[family as keyof typeof counts]?.get(year) ?? null
  const name = state === "US" ? "U.S. Congress" : stateName(state)
  const at = JURISDICTIONS.findIndex((j) => j.code === state)
  const previous = JURISDICTIONS[at - 1] ?? null
  const next = JURISDICTIONS[at + 1] ?? null
  const bills = sessions.reduce((sum, s) => sum + s.bills, 0)
  const latest = sessions[0]
  const file = (year: number, family: string, format: string) => `/api/dataset/${state.toLowerCase()}/${year}/${family}.${format}`
  const toc = sessions.map((s) => ({ title: s.name, url: `#session-${s.year}`, depth: 2 }))

  return (
    <DocsPage
      title={name}
      description={`${fmtNumber(bills)} bills across ${fmtNumber(sessions.length)} ${sessions.length === 1 ? "session" : "sessions"}, each as seven files.`}
      slug={`/docs/datasets/${state.toLowerCase()}`}
      previous={previous ? { name: previous.name, url: `/docs/datasets/${previous.code.toLowerCase()}` } : { name: "Bulk Datasets", url: "/docs/datasets" }}
      next={next ? { name: next.name, url: `/docs/datasets/${next.code.toLowerCase()}` } : { name: "Bills", url: "/bills" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <p>
        A file is one family of one session, whole: every row the record holds, as it stands the day the file is read. A session that is
        still sitting changes nightly, so a file is cached for a day and no longer. The families are the record&rsquo;s own tables; the texts
        are their own route, one bill at a time.
      </p>
      <ul>
        {DATASET_FAMILIES.map((f) => (
          <li key={f.name}>
            <strong>{f.name}</strong>
            {" — "}
            {f.summary}
          </li>
        ))}
      </ul>
      {latest && (
        <CommandBlock
          tabs={[
            { value: "curl", label: "curl", lines: [`curl -O "${HOST}${file(latest.year, "bills", "csv")}"`] },
            { value: "fetch", label: "fetch", lines: [`const bills = await fetch("${HOST}${file(latest.year, "bills", "json")}")`, `  .then((response) => response.json())`] },
            { value: "python", label: "python", lines: [`import pandas as pd`, ``, `bills = pd.read_csv("${HOST}${file(latest.year, "bills", "csv")}")`] },
          ]}
        />
      )}
      {sessions.map((s) => (
        <div key={s.year}>
          <hr />
          <H2 id={`session-${s.year}`}>{s.name}</H2>
          <p>
            <code>{fmtNumber(s.bills)}</code> {s.bills === 1 ? "bill" : "bills"}, in seven families, each as JSON or CSV.
          </p>
          {/* A list, not seven blocks: the family, what it holds, how many rows,
              and the two files — the typeset table (Brendan, 2026-09-05). */}
          <Table>
            <thead>
              <tr>
                <th className="w-[18%]">Entity</th>
                <th className="w-[46%]">Description</th>
                <th className="w-[16%]">Files</th>
                <th className="w-[20%] pr-8 text-right">Rows</th>
              </tr>
            </thead>
            <tbody>
              {DATASET_FAMILIES.map((f) => {
                const rows = rowsOf(f.name, s.year)
                return (
                  <tr key={f.name}>
                    <td>
                      <code>{f.name}</code>
                    </td>
                    <td>{f.summary}</td>
                    <td className="whitespace-nowrap">
                      <Link href={file(s.year, f.name, "json")} prefetch={false}>
                        json
                      </Link>
                      {" · "}
                      <Link href={file(s.year, f.name, "csv")} prefetch={false}>
                        csv
                      </Link>
                    </td>
                    {/* pr-8: the table's edge fade would otherwise sit on the last digits. */}
                    <td className="pr-8 text-right tabular-nums">{rows == null ? "—" : fmtNumber(rows)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="font-medium">Total</td>
                <td />
                <td />
                <td className="pr-8 text-right font-medium tabular-nums">
                  {(() => {
                    const total = DATASET_FAMILIES.reduce((sum, f) => sum + (rowsOf(f.name, s.year) ?? 0), 0)
                    return counts ? fmtNumber(total) : "—"
                  })()}
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
      ))}
    </DocsPage>
  )
}
