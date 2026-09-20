"use client"

import { Download } from "lucide-react"

import { Button } from "@govblock/ui/components/ny4/button"
import { cn } from "@govblock/ui/lib/utils"

// The download beside a file block's copy button (Brendan, 2026-09-20): the
// block's whole text as a file, named as the block's caption names it, with the
// path's slashes turned to dashes. Made in the browser when pressed; nothing
// is asked of the server.
export function DownloadButton({ value, filename, className }: { value: string; filename: string; className?: string }) {
  return (
    <Button
      data-slot="download-button"
      size="icon"
      variant="ghost"
      aria-label={`Download ${filename}`}
      className={cn("size-7 hover:opacity-100 focus-visible:opacity-100", className)}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }))
        const link = document.createElement("a")
        link.href = url
        link.download = filename.replace(/\//g, "-")
        link.click()
        URL.revokeObjectURL(url)
      }}
    >
      <Download />
    </Button>
  )
}
