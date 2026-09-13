import { notFound } from "next/navigation"

import { TypesetBench } from "./bench"

// A dev-only bench for the Typeset editor's speed (typeset-perf, 2026-09-13):
// the bill Typeset opens, in the same editor and toolbar, with plugins dropped
// by key from the query string, so each kit's cost is measured off one compile
// without touching the page Brendan is reviewing. docs/typeset-perf.md.

export default async function TypesetBenchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound()
  const sp = await searchParams
  return (
    <TypesetBench
      bill={sp.bill ?? "2058568"}
      drop={(sp.drop ?? "").split(",").filter(Boolean)}
      toolbar={sp.toolbar !== "0"}
      chunk={sp.chunk ? Number(sp.chunk) : undefined}
      nav={sp.nav !== "0"}
      cache={sp.cache === "1"}
      progressive={sp.progressive === "1"}
    />
  )
}
