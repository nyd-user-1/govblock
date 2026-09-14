import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetForkPage } from "@/components/workspace/typeset-fork"
import { one } from "@/lib/policy/db"
import { latestSession } from "@/lib/policy/db-queries"
import { buildWorkspacePath } from "@/lib/workspace/path"

// /workspace/typeset/fork/<id> (window 5, 2026-09-14): a reader's fork of a
// published unit, opened from My Files or from the XML reader's fork action.
// The fork's document and its base are fetched by the view
// (/api/typeset/fork), gated as the base is.

type Params = Promise<{ id: string }>

type Row = { id: number; state: string; session_id: number | null; label: string | null; work: string | null; base_work: string | null; base_expression: string | null }

const forkOf = (id: string) =>
  /^\d+$/.test(id) ? one<Row>(`select id, state, session_id, label, work, base_work, base_expression from "Forks" where id = $1 and work is not null`, [Number(id)]).catch(() => null) : Promise.resolve(null)

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const fork = await forkOf((await params).id)
  return { title: fork ? `${fork.label ?? fork.work} · Fork` : "Typeset" }
}

export default async function TypesetForkRoute({ params }: { params: Params }) {
  const fork = await forkOf((await params).id)
  if (!fork?.work || !fork.base_work || !fork.base_expression) notFound()
  const year = fork.session_id ?? (await latestSession(fork.state).catch(() => null))
  const myFiles = buildWorkspacePath({ state: fork.state, chamber: null, session: year ? Number(year) : null, location: { at: "my-files", committee: "", member: "", bill: "", rollcall: "" } })
  return (
    <LocksProvider>
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetForkPage forkId={Number(fork.id)} label={fork.label ?? fork.work} baseAddress={`${fork.base_work}@${fork.base_expression}`} baseLabel={`${fork.base_work} as of ${fork.base_expression.slice(0, 10)}`} myFiles={myFiles} />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
