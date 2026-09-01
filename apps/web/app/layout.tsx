import type { Metadata } from "next"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { siteConfig } from "@/lib/config"
import { fontVariables } from "@/lib/fonts"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { JurisdictionProvider } from "@/lib/policy/jurisdiction"
import { TooltipProvider } from "@govblock/ui/components/tooltip"
import { cn } from "@govblock/ui/lib/utils"

import "@govblock/ui/globals.css"

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s - ${siteConfig.name}` },
  description: siteConfig.description,
}

// Ported from livingston-v3 app/layout.tsx + app/(app)/layout.tsx. The header
// and footer heights are CSS variables the header, footer and scroll padding
// all read.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(fontVariables, "[--header-height:calc(var(--spacing)*14)] lg:[--header-height:calc(var(--spacing)*16)]")}
    >
      <body className="group/body overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] xl:[--footer-height:calc(var(--spacing)*24)]">
        <NuqsAdapter>
        <ThemeProvider>
          <TooltipProvider delay={0}>
            <JurisdictionProvider>
            <div data-slot="layout" className="group/layout relative z-10 flex min-h-svh flex-col bg-background has-data-[slot=designer]:h-svh has-data-[slot=designer]:overflow-hidden">
              <SiteHeader />
              <main className="flex min-h-0 flex-1 flex-col">{children}</main>
              <SiteFooter />
            </div>
            </JurisdictionProvider>
          </TooltipProvider>
        </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
