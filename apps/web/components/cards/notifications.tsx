"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { ComponentActions } from "@/components/card-frame"
import { SubscribeCardBody } from "@/components/cards/subscribe-card"
import { Card } from "@govblock/ui/components/card"

// Subscribe, on the home page: the address goes to the Subscribers table
// through /api/subscribe, with the jurisdiction in scope.
export function NotificationSettings() {
  const { state } = useJurisdiction()
  return (
    <Card>
      <SubscribeCardBody title={<CardAnchor>Subscribe</CardAnchor>} action={<ComponentActions id="subscribe" />} extra={{ state }} />
    </Card>
  )
}
