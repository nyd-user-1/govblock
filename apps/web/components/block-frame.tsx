"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"

// One block's preview, on its own — no toolbar, no device buttons, no resize
// handle, no dot grid. `/blocks/intelligence` is not a specimen of a block on a
// page about blocks; it is the inbox.
//
// The scope rides on the src for the same reason it does in the viewer: the
// document inside the frame has its own header, and without it the board renders
// Congress under a page that says Texas.
export function BlockFrame({
  styleName,
  name,
  title,
}: {
  styleName: string
  name: string
  title: string
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
      // The frame is the screen below the header, so the list inside it scrolls
      // rather than the page. `svh` and not `vh`: on a phone the browser chrome
      // is part of the viewport until it is not.
      className="no-scrollbar w-full border-0 bg-background"
      style={{ height: "calc(100svh - var(--header-height))" }}
    />
  )
}
