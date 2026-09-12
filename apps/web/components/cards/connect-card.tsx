"use client"

import * as React from "react"
import Link from "next/link"

import { CardShell } from "@/components/cards/card-shell"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@govblock/ui/components/avatar"
import { Button } from "@govblock/ui/components/button"
import { CardContent } from "@govblock/ui/components/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@govblock/ui/components/empty"

// An empty state with a row of marks and one call to action: Connect (Slack,
// Discord, Google Drive) and No Team Members on the home page are two of it.
// The marks are in their own colours; padding on the image, not the Avatar,
// and object-contain, because not every logo is square.
export type Mark = { name: string; src: string; fallback?: string }

export function ConnectCardBody({ marks, title, description, cta, href, onClick, grayscale = false, className }: { marks: Mark[]; title?: string; description: string; cta: string; href?: string; onClick?: () => void; grayscale?: boolean; className?: string }) {
  return (
    <CardContent>
      <Empty className={className ?? "border border-dashed"}>
        <EmptyHeader>
          <EmptyMedia>
            <AvatarGroup className={grayscale ? "grayscale" : undefined}>
              {marks.map((s) => (
                <Avatar key={s.name} size="lg" className={grayscale ? undefined : "bg-white"}>
                  <AvatarImage src={s.src} alt={s.name} className={grayscale ? undefined : "object-contain p-1.5"} />
                  <AvatarFallback>{s.fallback ?? s.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
          </EmptyMedia>
          {title && <EmptyTitle>{title}</EmptyTitle>}
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {href ? (
            <Button size="sm" render={<Link href={href} />} nativeButton={false}>
              {cta}
            </Button>
          ) : (
            <Button size="sm" onClick={onClick}>
              {cta}
            </Button>
          )}
        </EmptyContent>
      </Empty>
    </CardContent>
  )
}

export function ConnectCard(props: React.ComponentProps<typeof ConnectCardBody>) {
  return (
    <CardShell>
      <ConnectCardBody {...props} />
    </CardShell>
  )
}
