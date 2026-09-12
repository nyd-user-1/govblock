"use client"

import * as F from "@/lib/fixtures"
import { CardFrame } from "@/components/card-frame"
import { ConnectCardBody } from "@/components/cards/connect-card"

// Connect, on the home page — pointed at the places a team already works:
// Slack, Discord, Google Drive. No title: the marks and the sentence say it
// (Brendan, 2026-09-05).
export function ConnectCard() {
  return (
    <CardFrame id="connect">
      <ConnectCardBody marks={F.connect.services} description={F.connect.description} cta="Connect" href="/connectors" />
    </CardFrame>
  )
}
