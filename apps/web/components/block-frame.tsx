"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { cn } from "@/lib/utils"

// One block's preview, on its own — no toolbar, no device buttons, no resize
// handle, no dot grid. `/blocks/intelligence` is not a specimen of a block on a
// page about blocks; it is the inbox.
//
// The frame fills whatever its parent gives it: the page marks itself
// `data-slot="inbox"`, the root layout pins that page to the viewport and hides
// the footer, and this element is the flex child that takes the rest. The
// document inside sizes itself to the frame and scrolls its own panes, so the
// page never scrolls at all.
//
// The scope rides on the src for the same reason it does in the viewer: the
// document inside the frame has its own header, and without it the board renders
// Congress under a page that says Texas.
export function BlockFrame({
  styleName,
  name,
  title,
  className,
}: {
  styleName: string
  name: string
  title: string
  className?: string
}) {
  const { state, session, resolved } = useJurisdiction()
  const params = new URLSearchParams()
  if (resolved) {
    params.set("state", state)
    if (session) params.set("session", String(session))
  }
  const query = params.toString()

  return (
    <iframe
      src={`/view/${styleName}/${name}${query ? `?${query}` : ""}`}
      title={title}
      className={cn("no-scrollbar min-h-0 w-full flex-1 rounded-xl border bg-background", className)}
    />
  )
}
