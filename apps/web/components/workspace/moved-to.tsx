"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

// A retired address, sent to its workspace path with its query intact.
export function MovedTo({ path }: { path: string }) {
  const router = useRouter()
  React.useEffect(() => {
    router.replace(`${path}${window.location.search}`)
  }, [router, path])
  return <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">Moving to the workspace…</div>
}
