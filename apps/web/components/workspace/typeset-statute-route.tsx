import "server-only"

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
import { expressionsOf } from "@/lib/policy/expressions"
import { askOf, findExpression, getExpressionDocument } from "@/lib/typeset/expression-document"
import { prefixLabel, prefixOfWork } from "@/lib/xml/library"

// A statute in Typeset (Brendan, 2026-09-15: a statute's own URL, beside a
// bill's), at its address: /workspace/typeset/us/usc/t7/s1,
// /workspace/typeset/us/ny/code/agm/s16[?at=YYYY-MM-DD]. A stored Expression
// drawn by the reader, read from the store rather than from a bill row. The
// address may name an Expression (`…/s3@2024-01-01`) or a portion below the
// section (`…/s130i/a/1`); with neither, the latest, or the one in force on
// `at`. A stored bill with no row in "Bills" is drawn here too.

export const dateOfAt = (at: string | undefined | null) => (at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null)

export async function typesetStatuteMetadata(address: string, at: string | null): Promise<Metadata> {
  const found = await findExpression(address, at).catch(() => null)
  return { title: found ? `${found.row.label ?? found.row.work} · Typeset` : "Typeset" }
}

export async function TypesetStatuteRoute({ address, at }: { address: string; at: string | null }) {
  const found = await findExpression(address, at).catch((error) => {
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
  const history = doc ? doc.history : await expressionsOf(row.work).then((rows) => rows.map((r) => ({ expression: r.expression, date: r.expression_date, unit: r.unit, coverage: r.coverage })))
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
            billHref={null}
          />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
