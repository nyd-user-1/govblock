"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

import type { Target } from "@/lib/create/path"
import { DEFAULT_DESIGN } from "@/lib/create/preset"
import { useScope } from "@/lib/policy/scope"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { GIT_TAB_OF, typesetHref, viewOfGitTab, type TypesetView } from "@/lib/typeset/views"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

// Git, inside Typeset (Brendan, 2026-09-12): the bill as a file in a
// repository — the same view /workspace/data draws, with its find bar, its
// History button, Raw, copy, download, the pencil that duplicates to edit, the
// outline, and every commit — mounted on Typeset's routes. Nothing here is
// new; file-view.tsx is the view, and this maps its tabs to the routes:
// text ↔ /git, changes and history ↔ /versions, edit and fork ↔ /fork. The
// document and the fork stay in the query, as they always did.

const FileView = dynamic(() => import("@/components/create/file-view").then((m) => m.FileView), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
      ))}
    </div>
  ),
})

export type GitView = Extract<TypesetView, "git" | "versions" | "fork">

export function TypesetGitPane({ billId, view }: { billId: number; view: GitView }) {
  const router = useRouter()
  const scope = useScope()
  const q = useUrlParams(["doc", "fork"] as const)
  const node = React.useMemo(() => ({ kind: "bill" as const, id: billId }), [billId])
  // A fork route with no fork yet is the "make my copy" state file-view.tsx
  // already handles; with one, it is the editor.
  const tab = view === "fork" && !q.fork ? "fork" : GIT_TAB_OF[view]

  const navigate = React.useCallback(
    (target: Target) => {
      if (target.bill && Number(target.bill) !== billId) return router.push(typesetHref(target.bill, "git"))
      const next = "tab" in target ? viewOfGitTab(target.tab) : view
      const query = new URLSearchParams(window.location.search)
      for (const key of ["doc", "fork"] as const) {
        if (key in target) {
          if (target[key]) query.set(key, target[key]!)
          else query.delete(key)
        }
      }
      // A new view opens on its own first document unless one was named.
      if (!("doc" in target) && next !== view) query.delete("doc")
      const href = typesetHref(billId, next, query)
      if (href !== `${window.location.pathname}${window.location.search}`) router.push(href)
    },
    [billId, router, view]
  )

  return (
    <FileView
      node={node}
      scope={scope}
      design={DEFAULT_DESIGN}
      tab={tab}
      doc={q.doc}
      fork={q.fork}
      onTab={(t) => navigate({ tab: t })}
      onDoc={(id) => writeUrlParams({ doc: id ? String(id) : null }, { history: "push" })}
      onGo={navigate}
    />
  )
}
