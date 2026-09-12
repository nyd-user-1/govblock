"use client"

import { ConnectCardBody } from "@/components/cards/connect-card"
import { Card } from "@govblock/ui/components/card"

// shadcn's No Team Members empty state, as the home page carries it.
export function NoTeamMembers() {
  return (
    <Card>
      <ConnectCardBody
        grayscale
        className="h-56 border"
        marks={[
          { name: "@shadcn", src: "https://github.com/shadcn.png", fallback: "CN" },
          { name: "@maxleiter", src: "https://github.com/maxleiter.png", fallback: "LR" },
          { name: "@evilrabbit", src: "https://github.com/evilrabbit.png", fallback: "ER" },
        ]}
        title="No Team Members"
        description="Invite your team to collaborate on this project."
        cta="Invite Members"
      />
    </Card>
  )
}
