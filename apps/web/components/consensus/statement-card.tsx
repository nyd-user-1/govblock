"use client"

import * as React from "react"

import { Survey } from "@/components/consensus/survey"
import type { Conversation } from "@/lib/consensus/data"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@govblock/ui/components/nova/dialog"

// A statement card in the report's rail (Brendan, 2026-09-11): clicking it
// opens the vote card in an overlay, on that statement, so a reader can vote
// from the report without leaving it. The overlay is the survey at its full
// width; the survey no longer caps itself.

export function StatementCard({
  conversation,
  tid,
  className,
  children,
}: {
  conversation: Conversation
  tid: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={className} />}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-4rem)] overflow-y-auto p-8 sm:max-w-3xl">
        <DialogTitle className="sr-only">{conversation.title}</DialogTitle>
        <Survey conversation={conversation} startAt={tid} />
      </DialogContent>
    </Dialog>
  )
}
