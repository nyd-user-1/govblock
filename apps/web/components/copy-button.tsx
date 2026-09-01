"use client"

import * as React from "react"
import { IconCheck, IconCopy } from "@tabler/icons-react"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"

export function CopyButton({
  value,
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button> & { value: string }) {
  const [hasCopied, setHasCopied] = React.useState(false)

  React.useEffect(() => {
    if (!hasCopied) return
    const t = setTimeout(() => setHasCopied(false), 2000)
    return () => clearTimeout(t)
  }, [hasCopied])

  return (
    <Button
      data-slot="copy-button"
      size="icon"
      variant={variant}
      className={cn("size-7 hover:opacity-100 focus-visible:opacity-100", className)}
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setHasCopied(true)
      }}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? <IconCheck /> : <IconCopy />}
    </Button>
  )
}
