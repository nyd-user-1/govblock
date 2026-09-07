"use client"

import dynamic from "next/dynamic"

import { PageTitle } from "@/components/admin/page-title"

// Finance, with the other dashboards (Brendan, 2026-09-07): the FEC explorer
// on the dashboard's stage, under its header, the filters as pills. The
// explorer reads the browser's snapshot, so it mounts there only.
const FecExplorer = dynamic(() => import("@/components/policy/fec-explorer").then((m) => m.FecExplorer), { ssr: false })

export function FinancePage() {
  return (
    <div>
      <PageTitle title="Finance" />
      <div className="mt-4 sm:mt-5">
        <FecExplorer embedded />
      </div>
    </div>
  )
}
