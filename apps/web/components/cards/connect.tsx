"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { CardFrame } from "@/components/card-frame"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@govblock/ui/components/avatar"
import { Button } from "@govblock/ui/components/button"
import { CardContent } from "@govblock/ui/components/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@govblock/ui/components/empty"

// Connect — shadcn's "No Team Members" empty state, pointed at the places a
// team already works: Slack, Discord, Google Drive.
//
// The marks are in their own colours. They were grayscale, which item 13 fixed
// on the agents surfaces and missed here — a grayscale logo is a service nobody
// recognises at a glance, and recognising it at a glance is the whole job.
//
// Padding on the image and not on the Avatar, which is the lesson the small
// connection marks cost three attempts: the Avatar root is a flex row, and a
// padded root with a size-full child pushes the mark out from under itself.
// object-contain because two of the three logos are not square and the default
// object-cover crops them.
export function ConnectCard() {
  return (
    <CardFrame id="connect">
      <CardContent>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia>
              <AvatarGroup>
                {F.connect.services.map((s) => (
                  <Avatar key={s.name} size="lg" className="bg-white">
                    <AvatarImage src={s.src} alt={s.name} className="object-contain p-1.5" />
                    <AvatarFallback>{s.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
            </EmptyMedia>
            <EmptyTitle>{F.connect.title}</EmptyTitle>
            <EmptyDescription>{F.connect.description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" render={<Link href="/connectors" />} nativeButton={false}>
              Connect
            </Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </CardFrame>
  )
}
