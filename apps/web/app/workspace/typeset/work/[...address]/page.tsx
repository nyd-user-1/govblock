import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { ScopeMark } from "@/components/scope-mark"
import { TypesetWork } from "@/components/workspace/typeset-work"
import { entitled } from "@/lib/entitlements"
import { currentSession, readerOf } from "@/lib/entitlements-server"
import { q } from "@/lib/policy/db"
import { expressionsOf, type ExpressionRow } from "@/lib/policy/expressions"
import { askOf, findExpression, getExpressionDocument, sessionYear, stateOfJurisdiction } from "@/lib/typeset/expression-document"
import { typesetHref } from "@/lib/typeset/views"
import { prefixLabel, prefixOfWork } from "@/lib/xml/library"

// /workspace/typeset/work/<address>[?at=YYYY-MM-DD] (window 4, 2026-09-14): a
// Work in the XML view by its address (docs/xml/schema.md), read from the
// stored Expression rather than from a bill row, so a statute section opens
// the way a bill printing does. The address may name an Expression
// (`…/s3@2024-01-01`) or a portion below the Work (`…/s130i/a/1`); with
// neither, the latest, or the one in force on `at`.

type Params = Promise<{ address: string[] }>
type Search = Promise<{ at?: string }>

const addressOf = (parts: string[]) => `/${parts.map((p) => decodeURIComponent(p)).join("/")}`
const dateOf = (at: string | undefined) => (at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null)

const LEGISCAN_TYPE: Record<string, string> = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }

/** A bill Work's row in "Bills", for Typeset's own views of it. */
async function billHrefOf(row: ExpressionRow): Promise<string | null> {
  const [, jurisdiction, , session, type, number] = row.work.split("/")
  const year = sessionYear(jurisdiction, session ?? null)
  if (!year || !type || !number) return null
  const state = stateOfJurisdiction(jurisdiction)
  const letters = state === "US" ? (LEGISCAN_TYPE[type] ?? type.toUpperCase()) : type.toUpperCase()
  const special = /s/.test(session ?? "")
  const rows = await q<{ bill_id: number }>(
    `select bill_id from "Bills" where state = $1 and session_id = $2 and bill_number ~* $3
      order by (coalesce(session_title, '') ~* 'special|extraordinary') = $4 desc limit 1`,
    [state, year, `^${letters}\\s*0*${number.replace(/[^A-Za-z0-9-]/g, "")}$`, special]
  ).catch(() => [])
  return rows[0] ? typesetHref(rows[0].bill_id, "xml") : null
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const found = await findExpression(addressOf((await params).address), dateOf((await searchParams).at)).catch(() => null)
  return { title: found ? `${found.row.label ?? found.row.work} · XML` : "Typeset" }
}

export default async function TypesetWorkPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const address = addressOf((await params).address)
  const found = await findExpression(address, dateOf((await searchParams).at)).catch((error) => {
    console.error("work view: could not resolve", address, error)
    return null
  })
  if (!found) notFound()
  const { row, portion } = found

  const ask = askOf(row)
  const current = ask.entity === "bills" ? await currentSession(ask.state!).catch(() => null) : null
  const verdict = entitled(await readerOf(), { ...ask, current })
  const doc =
    verdict === "open"
      ? await getExpressionDocument(row, portion).catch((error) => {
          console.error("work view: could not build", row.work, row.expression, error)
          return null
        })
      : null
  const [history, billHref] = await Promise.all([
    doc ? doc.history : expressionsOf(row.work).then((rows) => rows.map((r) => ({ expression: r.expression, date: r.expression_date, unit: r.unit, coverage: r.coverage }))),
    row.kind === "bill" ? billHrefOf(row) : null,
  ])
  const prefix = prefixOfWork(row.work)

  return (
    <LocksProvider>
      <ScopeMark state={ask.state!} session={ask.session ?? null} current={current} entity={ask.entity ?? "laws"} />
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
        <TypesetWork
          work={row.work}
          expression={row.expression}
          label={row.label ?? row.work}
          kind={row.kind}
          prefix={{ address: prefix, label: prefixLabel(prefix, row.label) }}
          portion={portion}
          history={history}
          snapshot={doc?.html ?? null}
          meta={doc?.meta ?? null}
          jsonUrl={verdict === "open" ? `/api/typeset/work?${new URLSearchParams({ address: `${row.work}@${row.expression}` })}` : null}
          door={verdict === "open" ? null : verdict === "sign-in" ? "sign-in" : "plan"}
          billHref={billHref}
        />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
