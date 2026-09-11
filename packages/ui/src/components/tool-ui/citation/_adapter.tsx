/**
 * Adapter: UI and utility re-exports for copy-standalone portability.
 *
 * tool-ui writes against Radix's Popover; the site's popover is Base UI's
 * (components/nova/popover). The two wrappers below translate what the
 * citation files use: Radix's `asChild` becomes Base UI's `render`, and the
 * Radix-only focus callbacks (onOpenAutoFocus, onCloseAutoFocus,
 * onEscapeKeyDown) — which the citation popovers use to keep focus where it
 * was while they open on hover — become `initialFocus={false}` and
 * `finalFocus={false}`. Nothing else in the citation files is touched.
 */
"use client"

import * as React from "react"

import {
  Popover,
  PopoverContent as BaseContent,
  PopoverTrigger as BaseTrigger,
} from "@govblock/ui/components/nova/popover"

export { cn } from "@govblock/ui/lib/utils"
export { Popover }

type TriggerProps = React.ComponentProps<typeof BaseTrigger> & { asChild?: boolean }

export function PopoverTrigger({ asChild, children, ...props }: TriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return <BaseTrigger {...props} render={children as React.ReactElement<Record<string, unknown>>} />
  }
  return <BaseTrigger {...props}>{children}</BaseTrigger>
}

type ContentProps = React.ComponentProps<typeof BaseContent> & {
  onOpenAutoFocus?: (e: Event) => void
  onCloseAutoFocus?: (e: Event) => void
  onEscapeKeyDown?: (e: KeyboardEvent) => void
}

export function PopoverContent({ onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, ...props }: ContentProps) {
  const keepFocus = Boolean(onOpenAutoFocus || onCloseAutoFocus)
  return <BaseContent {...props} {...(keepFocus ? { initialFocus: false, finalFocus: false } : {})} />
}
