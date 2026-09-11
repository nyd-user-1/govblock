"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"

import { refreshDesk } from "@/app/desk/[state]/actions"
import { cn } from "@govblock/ui/lib/utils"

// A desk section with a refresh (Brendan, 2026-09-11): the small icon after
// its heading drops the desk's cached page and draws it again from the
// tables, and while that runs the section shows its own shape as a skeleton
// — the rows it will have, blank — rather than the stale rows.
export function DeskRefreshable({ state, kind, title, skeleton, children }: { state: string; kind: "stage" | "rail"; title: string; skeleton: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const button = (
    <button
      type="button"
      aria-label="Refresh"
      title="Refresh"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await refreshDesk(state)
          router.refresh()
        })
      }
      className={cn("inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60", kind === "stage" ? "ml-2 size-7" : "ml-1 size-6")}
    >
      <RefreshCwIcon className={cn(kind === "stage" ? "size-4" : "size-3.5", pending && "animate-spin")} />
    </button>
  )
  return (
    <section className={cn("flex flex-col", kind === "stage" ? "gap-5" : "gap-4")}>
      {kind === "stage" ? (
        <h2 className="cn-font-heading flex items-center text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
          {button}
        </h2>
      ) : (
        <h2 className="cn-font-heading flex items-center text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {title}
          {button}
        </h2>
      )}
      {pending ? skeleton : children}
    </section>
  )
}
