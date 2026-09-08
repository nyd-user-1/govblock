"use client"

import * as React from "react"
import Link from "next/link"

import { fmtBill, fmtCompact, fmtDate, fmtNumber, truncate } from "@/lib/format"
import type { Department } from "@/lib/data/departments"
import type { BillRow } from "@/lib/policy/db-queries"
import type { DepartmentBudget, DepartmentNomination } from "@/lib/policy/department-queries"
import type { FormRow } from "@/lib/policy/forms-queries"
import { nominationPath } from "@/lib/policy/congress-hrefs"
import { Button } from "@govblock/ui/components/nova/button"
import { Chip } from "@/components/chip"
import { MemberTabs } from "@/components/policy/member-tabs"
import { PagedList } from "@/components/policy/paged-list"
import { RecordItem, RecordSeal } from "@/components/policy/record-item"
import { PreviewFrame } from "@/components/preview-frame"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H3, Table } from "@/components/typeset"

// A department's page, on the member page's design (Brendan, 2026-09-06:
// "Summary, a rule, then Budget with the three tables, and the bills that
// name the department… nominations, forms. that's a start"). Every block is
// one the other record pages draw: the tabs over a typeset table, the paged
// list of record items.

const money = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`)
/** The spending table is in thousands, as the Division of the Budget prints it. */
const thousands = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}K`)
const sum = <T,>(rows: T[], pick: (r: T) => number | null) => rows.reduce((total, r) => total + (pick(r) ?? 0), 0)

/** A typeset table that shows its first rows and a See more for the rest, as the card grid does. */
function Rows<T>({ rows, initial = 20, render }: { rows: T[]; initial?: number; render: (shown: T[]) => React.ReactNode }) {
  const [all, setAll] = React.useState(false)
  const shown = all ? rows : rows.slice(0, initial)
  return (
    <>
      {render(shown)}
      {rows.length > initial && (
        <div className="flex pt-2">
          <Button variant="outline" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? "See fewer" : `See more (${fmtNumber(rows.length - initial)})`}
          </Button>
        </div>
      )}
    </>
  )
}

export function DepartmentBudgetBlock({ budget, who }: { budget: DepartmentBudget; who: string }) {
  const { appropriations, capital, spending } = budget
  if (!appropriations.length && !capital.length && !spending.length) return null
  const recommended = sum(appropriations, (r) => r.recommended)
  const capitalTotal = sum(capital, (r) => r.recommended) + sum(capital, (r) => r.reappropriations)
  const spendingNext = sum(spending, (r) => r.estimate_next)
  const appropriationsTable = (shown: typeof appropriations) => (
    <Table>
      <thead>
        <tr>
          <th className="w-[40%]">Program</th>
          <th className="w-[24%]">Fund</th>
          <th className="w-[18%] text-right">2025–26</th>
          <th className="w-[18%] pr-8 text-right">2026–27</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r, i) => (
          <tr key={`${r.program}-${r.fund_name}-${i}`}>
            <td>{r.program ?? "—"}</td>
            <td>{r.fund_type ?? r.fund_name ?? "—"}</td>
            <td className="text-right whitespace-nowrap tabular-nums">{money(r.available_prior)}</td>
            <td className="pr-8 text-right whitespace-nowrap tabular-nums">{money(r.recommended)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="font-medium">Total</td>
          <td></td>
          <td className="text-right font-medium whitespace-nowrap tabular-nums">{money(sum(appropriations, (r) => r.available_prior))}</td>
          <td className="pr-8 text-right font-medium whitespace-nowrap tabular-nums">{money(recommended)}</td>
        </tr>
      </tfoot>
    </Table>
  )
  const capitalTable = (shown: typeof capital) => (
    <Table>
      <thead>
        <tr>
          <th className="w-[26%]">Program</th>
          <th className="w-[38%]">Description</th>
          <th className="w-[18%] text-right">Recommended</th>
          <th className="w-[18%] pr-8 text-right">Reappropriated</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r, i) => (
          <tr key={`${r.program}-${r.description}-${i}`}>
            <td>{r.program ?? "—"}</td>
            <td>{truncate(r.description ?? r.purpose ?? "", 120) || "—"}</td>
            <td className="text-right whitespace-nowrap tabular-nums">{money(r.recommended)}</td>
            <td className="pr-8 text-right whitespace-nowrap tabular-nums">{money(r.reappropriations)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="font-medium">Total</td>
          <td></td>
          <td className="text-right font-medium whitespace-nowrap tabular-nums">{money(sum(capital, (r) => r.recommended))}</td>
          <td className="pr-8 text-right font-medium whitespace-nowrap tabular-nums">{money(sum(capital, (r) => r.reappropriations))}</td>
        </tr>
      </tfoot>
    </Table>
  )
  const spendingTable = (shown: typeof spending) => (
    <Table>
      <thead>
        <tr>
          <th className="w-[28%]">Function</th>
          <th className="w-[24%]">Fund</th>
          <th className="w-[16%] text-right">2024–25</th>
          <th className="w-[16%] text-right">2025–26</th>
          <th className="w-[16%] pr-8 text-right">2026–27</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r, i) => (
          <tr key={`${r.function}-${r.fund}-${i}`}>
            <td>{r.function ?? "—"}</td>
            <td>{r.fund ?? r.fund_type ?? "—"}</td>
            <td className="text-right whitespace-nowrap tabular-nums">{thousands(r.actual_prior)}</td>
            <td className="text-right whitespace-nowrap tabular-nums">{thousands(r.estimate_current)}</td>
            <td className="pr-8 text-right whitespace-nowrap tabular-nums">{thousands(r.estimate_next)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="font-medium">Total</td>
          <td></td>
          <td className="text-right font-medium whitespace-nowrap tabular-nums">{thousands(sum(spending, (r) => r.actual_prior))}</td>
          <td className="text-right font-medium whitespace-nowrap tabular-nums">{thousands(sum(spending, (r) => r.estimate_current))}</td>
          <td className="pr-8 text-right font-medium whitespace-nowrap tabular-nums">{thousands(spendingNext)}</td>
        </tr>
      </tfoot>
    </Table>
  )
  return (
    <>
      <H3>Budget</H3>
      <p>
        The Executive Budget for 2026–27 recommends {fmtCompact(recommended)} in appropriations for <Chip>{who}</Chip>
        {capital.length ? <>, {fmtCompact(capitalTotal)} in capital</> : null}
        {spending.length ? <>, and estimates {fmtCompact(spendingNext * 1000)} in spending</> : null}.
      </p>
      <PreviewFrame>
        <MemberTabs
          tabs={[
            {
              value: "appropriations",
              label: "Appropriations",
              emoji: "🏛️",
              count: appropriations.length,
              content: (
                <div className="typeset">
                  <Rows rows={appropriations} render={appropriationsTable} />
                </div>
              ),
            },
            {
              value: "capital",
              label: "Capital",
              emoji: "🏗️",
              count: capital.length,
              content: (
                <div className="typeset">
                  <Rows rows={capital} render={capitalTable} />
                </div>
              ),
            },
            {
              value: "spending",
              label: "Spending",
              emoji: "💵",
              count: spending.length,
              content: (
                <div className="typeset">
                  <Rows rows={spending} render={spendingTable} />
                </div>
              ),
            },
          ].filter((t) => t.count > 0)}
        />
      </PreviewFrame>
    </>
  )
}

export function DepartmentBills({ rows, total, department, state, session, who }: { rows: BillRow[]; total: number; department: Department; state: string; session: number; who: string }) {
  if (!total) return null
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/department-bills?state=${state}&session=${session}&slug=${department.slug}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: BillRow[] }
    return data.rows ?? []
  }
  return (
    <>
      <H3>Bills</H3>
      <p>
        {fmtNumber(total)} {total === 1 ? "bill names" : "bills name"} <Chip>{who}</Chip> this session.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          total={total}
          more={more}
          pageSize={5}
          render={(bill, index) => (
            <RecordItem
              key={bill.bill_id}
              stacked
              hover="rail"
              href={`/docs/bills/${bill.bill_id}`}
              avatar={<RecordSeal state={state} chamber={bill.body} ordinal={index + 1} />}
              title={fmtBill(bill.bill_number, state)}
              lead={bill.last_action}
              meta={[bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.status_desc || "Introduced", bill.sponsor]}
              description={truncate(bill.title, 240)}
            />
          )}
        />
      </PreviewFrame>
    </>
  )
}

export function DepartmentNominations({ rows, total, department, who }: { rows: DepartmentNomination[]; total: number; department: Department; who: string }) {
  if (!total) return null
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/department-nominations?state=US&slug=${department.slug}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: DepartmentNomination[] }
    return data.rows ?? []
  }
  return (
    <>
      <H3>Nominations</H3>
      <p>
        The Senate has received {fmtNumber(total)} {total === 1 ? "nomination" : "nominations"} to <Chip>{who}</Chip> this Congress.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          total={total}
          more={more}
          pageSize={5}
          render={(r, index) => (
            <RecordItem
              key={r.key}
              stacked
              hover="rail"
              href={nominationPath(r)}
              avatar={<RecordSeal state="US" chamber="Senate" ordinal={index + 1} />}
              title={r.citation ?? r.key}
              lead={r.latest_action}
              meta={[r.received ? `Received ${fmtDate(r.received)}` : null, r.organization]}
              description={truncate(r.description ?? "", 240)}
            />
          )}
        />
      </PreviewFrame>
    </>
  )
}

export function DepartmentForms({ rows, total, inspected, department, state, who }: { rows: FormRow[]; total: number; inspected: boolean; department: Department; state: string; who: string }) {
  if (!total) return null
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/department-forms?state=${state}&slug=${department.slug}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: FormRow[] }
    return data.rows ?? []
  }
  const codes = department.forms.join(", ")
  return (
    <>
      <H3>Forms</H3>
      <p>
        <Chip>{who}</Chip> publishes {fmtNumber(total)} {inspected ? (total === 1 ? "form" : "forms") : total === 1 ? "document" : "documents"}, filed under {codes}
        {inspected ? "" : "; none has been opened yet, so the forms among them are not yet sorted from the rest"}.{" "}
        <Link href={`/docs/forms?state=${state}&agency=${encodeURIComponent(department.forms[0] ?? "")}${inspected ? "" : "&all=1"}`}>See them all</Link>.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          total={total}
          more={more}
          pageSize={5}
          render={(form, index) => (
            <RecordItem
              key={form.id}
              stacked
              hover="rail"
              href={`/docs/forms/${form.id}`}
              avatar={<RecordSeal state={state} chamber={null} ordinal={index + 1} />}
              title={form.number}
              lead={form.agency}
              meta={[form.pages ? `${form.pages} ${form.pages === 1 ? "page" : "pages"}` : null, form.fields ? `${form.fields} fields` : null, form.archived ? `Archived ${fmtDate(form.archived)}` : null]}
              description={truncate(form.title ?? form.file, 200)}
            />
          )}
        />
      </PreviewFrame>
    </>
  )
}

export function DepartmentToc({ parts }: { parts: string[] }) {
  return <DocsTableOfContents toc={[{ title: "Summary", url: "#summary", depth: 2 }, { title: "Record", url: "#record", depth: 2 }, ...parts.map((title) => ({ title, url: `#${title.toLowerCase()}`, depth: 3 }))]} />
}
