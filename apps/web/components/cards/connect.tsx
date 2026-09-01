"use client"

import * as F from "@/lib/fixtures"
import { CardFrame } from "@/components/card-frame"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@govblock/ui/components/avatar"
import { Button } from "@govblock/ui/components/button"
import { CardContent } from "@govblock/ui/components/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@govblock/ui/components/empty"

// Connect — shadcn's "No Team Members" empty state, pointed at the places a
// team already works: Slack, Discord, Google Drive.
export function ConnectCard() {
  return (
    <CardFrame id="connect">
      <CardContent>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia>
              <AvatarGroup>
                {F.connect.services.map((s) => (
                  <Avatar key={s.name} size="lg" className="grayscale">
                    <AvatarImage src={s.src} alt={s.name} />
                    <AvatarFallback>{s.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
            </EmptyMedia>
            <EmptyTitle>{F.connect.title}</EmptyTitle>
            <EmptyDescription>{F.connect.description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm">Connect</Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </CardFrame>
  )
}
