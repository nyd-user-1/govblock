"use client"

import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import type { NominationAction } from "@/lib/policy/committee-queries"
import { ActionTable, type ActionTableRow } from "@/components/policy/bill-tables"
import { CardBlock, type CardSpec } from "@/components/policy/card-block"
import { ChamberSeal } from "@/components/policy/imagery"
import { PreviewFrame } from "@/components/preview-frame"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H3, Table } from "@/components/typeset"
import { Chip } from "@/components/chip"

// A nomination's page, on the member page's design: the citation as the name,
// the organization and the date received as the facts, the nominee and the
// position as the Summary, then the actions in the bill page's action table,
// the committees it went to as cards, and the hearings it had. Every row
// comes from congress.gov's nomination family, landed 2026-09-06.

const STATE = "US"

export function NominationActions({ actions, who }: { actions: NominationAction[]; who: string }) {
  if (!actions.length) return null
  const rows: ActionTableRow[] = actions.map((a) => ({
    id: a.key,
    date: a.date ?? "",
    time: null,
    chamber: "Senate",
    text: a.text ?? "",
    committees: a.committees.map((c) => ({ code: c.code ? c.code.toLowerCase() : null, name: c.name })),
    roll: null,
  }))
  const first = actions[actions.length - 1]
  const last = actions[0]
  return (
    <>
      <H3>Actions</H3>
      <p>
        <Chip>{who}</Chip> has {fmtNumber(actions.length)} {actions.length === 1 ? "action" : "actions"} on the record
        {first?.date && last?.date && first.date !== last.date ? (
          <>
            , from {fmtDate(first.date)} to {fmtDate(last.date)}
          </>
        ) : first?.date ? (
          <>, on {fmtDate(first.date)}</>
        ) : null}
        .
      </p>
      <PreviewFrame>
        <ActionTable rows={rows} />
      </PreviewFrame>
    </>
  )
}

export function NominationCommittees({ committees, who }: { committees: { code: string | null; name: string | null; chamber: string | null; activities: { name?: string; date?: string }[] }[]; who: string }) {
  if (!committees.length) return null
  const cards: CardSpec[] = committees.map((c, i) => {
    const latest = [...c.activities].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0]
    return {
      key: c.code ?? String(i),
      href: c.code ? `/docs/committees/${c.code.toLowerCase()}` : "/docs/committees?state=US",
      title: c.name ?? c.code ?? "Committee",
      media: <ChamberSeal state={STATE} chamber={c.chamber ?? "Senate"} size={28} />,
      meta: latest ? `${latest.name ?? "Referred"}${latest.date ? ` · ${fmtDate(latest.date)}` : ""}` : "Referred",
    }
  })
  return (
    <>
      <H3>Committees</H3>
      <p>
        <Chip>{who}</Chip> was referred to {committees.length} {committees.length === 1 ? "committee" : "committees"}.
      </p>
      <CardBlock cards={cards} />
    </>
  )
}

export function NominationHearings({ hearings, who }: { hearings: { key: string; jacket: string | null; date: string | null; citation: string | null; number: string | null }[]; who: string }) {
  if (!hearings.length) return null
  return (
    <>
      <H3>Hearings</H3>
      <p>
        <Chip>{who}</Chip> had {hearings.length} {hearings.length === 1 ? "hearing" : "hearings"}.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[40%]">Citation</th>
            <th className="w-[30%]">Number</th>
            <th className="w-[30%] pr-8 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {hearings.map((h) => (
            <tr key={h.key}>
              <td>{h.jacket ? <Link href={`/docs/hearings/${h.jacket}`}>{h.citation ?? `Jacket ${h.jacket}`}</Link> : (h.citation ?? "—")}</td>
              <td>{h.number ?? "—"}</td>
              <td className="pr-8 text-right whitespace-nowrap tabular-nums">{h.date ? fmtDate(h.date) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

export function NominationToc({ parts }: { parts: string[] }) {
  return <DocsTableOfContents toc={[{ title: "Summary", url: "#summary", depth: 2 }, { title: "Record", url: "#record", depth: 2 }, ...parts.map((title) => ({ title, url: `#${title.toLowerCase()}`, depth: 3 }))]} />
}
