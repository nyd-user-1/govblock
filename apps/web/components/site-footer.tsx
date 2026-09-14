"use client"

import { usePathname } from "next/navigation"

import { siteConfig } from "@/lib/config"

// Ported from livingston-v3 components/site-footer.tsx; the credit is ours (Brendan, 2026-09-07).
// On /unite and /unite-2 only (Brendan, 2026-09-13): every other page goes without it.
const WHERE = new Set(["/unite", "/unite-2"])

export function SiteFooter() {
  const pathname = usePathname() ?? "/"
  if (!WHERE.has(pathname.replace(/\/+$/, "") || "/")) return null
  return (
    <footer
      data-slot="site-footer"
      className="group-has-[.section-soft]/body:bg-surface/40 dark:bg-transparent dark:group-has-[.section-soft]/body:bg-surface/40 3xl:fixed:bg-transparent"
    >
      <div className="container-wrapper px-4 xl:px-6">
        <div className="flex h-(--footer-height) items-center justify-between">
          <div className="w-full px-1 text-center text-xs leading-loose text-muted-foreground sm:text-sm">
            Built by{" "}
            <a href="https://github.com/nyd-user-1" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
              NYD-user-1
            </a>{" "}
            at{" "}
            <a href="https://nysgpt.com" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
              NYSgpt
            </a>
            . The source code is available on{" "}
            <a href={siteConfig.links.github} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
              GitHub
            </a>
            .
          </div>
        </div>
      </div>
    </footer>
  )
}
