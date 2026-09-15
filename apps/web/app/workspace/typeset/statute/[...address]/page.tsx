import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
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
import { askOf, findExpression, getExpressionDocument } from "@/lib/typeset/expression-document"
import { billHrefOfWork } from "@/lib/typeset/bill-href"
import { statuteAddress } from "@/lib/xml/library"
import { typesetHref } from "@/lib/typeset/views"
import { prefixLabel, prefixOfWork } from "@/lib/xml/library"

// /workspace/typeset/statute/<jurisdiction>/<code>/<section>[?at=YYYY-MM-DD]
// (Brendan, 2026-09-15: a statute's own URL, beside a bill's
// /workspace/typeset/bill/<id>/<view>): a stored Expression drawn by the
// reader, read from the store rather than from a bill row. The path may name
// an Expression (`…/s3@2024-01-01`) or a portion below the section
// (`…/s130i/a/1`); with neither, the latest, or the one in force on `at`. A
// bill's address here goes to the bill's own page.

type Params = Promise<{ address: string[] }>
type Search = Promise<{ at?: string }>

const addressOf = statuteAddress
const dateOf = (at: string | undefined) => (at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null)

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const found = await findExpression(addressOf((await params).address), dateOf((await searchParams).at)).catch(() => null)
  return { title: found ? `${found.row.label ?? found.row.work} · Typeset` : "Typeset" }
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
    row.kind === "bill" ? billHrefOfWork(row.work) : null,
  ])
  if (row.kind === "bill" && billHref) redirect(billHref)
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
