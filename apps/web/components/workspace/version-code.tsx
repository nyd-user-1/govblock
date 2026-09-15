"use client"

import * as React from "react"
import Link from "next/link"

import { GLOSSARY_VERSIONS, VERSION_BY_CODE } from "@/lib/typeset/versions"
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "@govblock/ui/components/animate-ui/components/base/dialog"
import { cn } from "@govblock/ui/lib/utils"

// A printing's stage code (`enr`) as a chip that explains itself: pressed, a
// dialog says what GovInfo means by it and links the glossary's table
// (Brendan, 2026-09-15).
export function VersionCode({ code, className }: { code: string; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const entry = VERSION_BY_CODE.get(code.toLowerCase())
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn("rounded border border-border bg-muted/40 px-1.5 py-px font-mono text-[11px] leading-4 text-foreground hover:bg-muted", className)}
      >
        {code}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup from="top" showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{entry ? `${entry.name} (${code.toUpperCase()})` : code.toUpperCase()}</DialogTitle>
            <DialogDescription>{entry ? entry.description : "A printing stage GovInfo does not list."}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            <Link href={GLOSSARY_VERSIONS} className="underline underline-offset-4" onClick={() => setOpen(false)}>
              Every bill text version, in the glossary
            </Link>
          </p>
        </DialogPopup>
      </Dialog>
    </>
  )
}

/** The footer's version chip asks the file chrome to open its Versions panel. */
export const VERSIONS_EVENT = "typeset:versions"
export const openVersionsPanel = () => window.dispatchEvent(new Event(VERSIONS_EVENT))
