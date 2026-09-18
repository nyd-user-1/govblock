import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { fmtDate } from "@/lib/format"
import { REPORTS } from "@/lib/reports/registry"

// /research's reports as cards (2026-09-17): what each asks and which bodies
// of data it reads.

export function ReportCards() {
  return (
    <div data-not-typeset="true" className="grid gap-4 sm:grid-cols-2">
      {REPORTS.map((r) => (
        <Link key={r.slug} href={r.href} className="group flex flex-col gap-3 rounded-xl border bg-card p-5 no-underline transition-colors hover:bg-accent/40">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {fmtDate(r.published)}
          </span>
          <span className="text-base leading-snug font-semibold text-foreground">{r.title}</span>
          <span className="text-sm text-muted-foreground">{r.dek}</span>
          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {r.data.map((d) => (
              <span key={d} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {d}
              </span>
            ))}
            <ArrowRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  )
}
