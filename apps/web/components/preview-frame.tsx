"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"

// Ported from livingston-v3 components/component-preview-tabs.tsx, left-to-right
// only: the docs' component frame — the rendered thing above, its code beneath
// behind a three-line peek and "View Code".
export function PreviewFrame({
  className,
  previewClassName,
  align = "center",
  component,
  source,
  sourcePreview,
  ...props
}: React.ComponentProps<"div"> & {
  previewClassName?: string
  align?: "center" | "start" | "end"
  component: React.ReactNode
  source: React.ReactNode
  sourcePreview?: React.ReactNode
}) {
  const [codeVisible, setCodeVisible] = React.useState(false)
  return (
    <div data-slot="component-preview" data-not-typeset="" className={cn("group relative mt-4 mb-12 flex flex-col overflow-hidden rounded-2xl border", className)} {...props}>
      <div data-slot="preview" dir="ltr">
        <div
          data-align={align}
          className={cn(
            "preview relative flex h-72 w-full justify-center p-10 data-[align=center]:items-center data-[align=end]:items-start data-[align=start]:items-start sm:data-[align=end]:items-end",
            previewClassName
          )}
        >
          {component}
        </div>
      </div>
      <div
        data-slot="code"
        data-mobile-code-visible={codeVisible}
        className="relative overflow-hidden **:data-[slot=copy-button]:right-4 **:data-[slot=copy-button]:hidden data-[mobile-code-visible=true]:**:data-[slot=copy-button]:flex [&_[data-rehype-pretty-code-figure]]:m-0! [&_[data-rehype-pretty-code-figure]]:rounded-t-none [&_[data-rehype-pretty-code-figure]]:border-t [&_pre]:max-h-72"
      >
        {codeVisible ? (
          source
        ) : (
          <div className="relative">
            {sourcePreview ?? source}
            <div className="absolute inset-0 flex items-center justify-center pb-4">
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--color-code), color-mix(in oklab, var(--color-code) 60%, transparent), transparent)" }} />
              <Button type="button" size="sm" variant="outline" className="relative z-10 rounded-lg bg-background text-foreground shadow-none hover:bg-muted dark:bg-background dark:text-foreground dark:hover:bg-muted" onClick={() => setCodeVisible(true)}>
                View Code
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
