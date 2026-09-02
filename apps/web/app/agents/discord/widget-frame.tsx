"use client"

import * as React from "react"
import { useTheme } from "next-themes"

// Discord's own widget, in our frame. It is an iframe because that is what
// Discord ships and reimplementing it would mean inventing presence we cannot
// see — the point of embedding the official one is that it is theirs and it is
// live.
//
// The theme is read on the client because ours is: rendering it dark on the
// server and then finding out the reader is in light mode would flash.
// The guild id arrives as a prop rather than an import: the module that knows
// it is server-only, and reaching into it from here would drag a Secrets
// Manager client into the browser bundle.
export function WidgetFrame({ guildId, title }: { guildId: string; title: string }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted)
    return <div className="h-[500px] w-full max-w-[350px] animate-pulse rounded-lg bg-muted" />

  return (
    <iframe
      title={title}
      src={`https://discord.com/widget?id=${guildId}&theme=${resolvedTheme === "light" ? "light" : "dark"}`}
      width="350"
      height="500"
      allowTransparency
      frameBorder="0"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
      className="w-full max-w-[350px] rounded-lg border"
    />
  )
}
