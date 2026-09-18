import { NextResponse } from "next/server"

import type { ChartSpec } from "@/lib/reports/chart-spec"
import { cryptoStudy } from "@/lib/reports/crypto"
import { obbbStudy } from "@/lib/reports/obbb"
import { electionsStudy } from "@/lib/reports/elections"
import { fecStudy } from "@/lib/reports/fec"
import { formsStudy } from "@/lib/reports/forms"
import { hr1Study } from "@/lib/reports/hr1"
import { openPrimariesStudy } from "@/lib/reports/open-primaries"

// GET /api/reports/charts: every report's charts as specs, for the chart
// studio (2026-09-17). Counted with the reports, once a day.

export const revalidate = 86400

export async function GET() {
  const studies = await Promise.allSettled([cryptoStudy(), obbbStudy(), hr1Study(), openPrimariesStudy(), electionsStudy(), fecStudy(), formsStudy()])
  const charts: ChartSpec[] = studies.flatMap((s) => (s.status === "fulfilled" ? s.value.charts : []))
  return NextResponse.json(charts, { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } })
}
