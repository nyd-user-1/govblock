"use client"

import * as React from "react"
import { CheckIcon, LinkIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"

// A profile's two controls (Brendan, 2026-09-18): copy the page's link, and
// follow. Following is held in the tab only until readers can follow each other.

export function CopyProfileLink() {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Copy link"
      className="rounded-xl"
      onClick={() => {
        void navigator.clipboard.writeText(window.location.href.split("#")[0]!)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
    </Button>
  )
}

export function FollowButton() {
  const [on, setOn] = React.useState(false)
  return (
    <Button variant={on ? "outline" : "default"} className="rounded-xl" onClick={() => setOn((v) => !v)}>
      {on ? "Following" : "Follow"}
    </Button>
  )
}
