"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { fromCreateQuery } from "@/lib/workspace/path"

// The old /create address, read off the address bar and replaced with its
// workspace path. The query is what decides the destination, so this runs in
// the browser rather than as a static redirect.
export function CreateRedirect() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace(fromCreateQuery(window.location.search))
  }, [router])
  return <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">Moving to the workspace…</div>
}
