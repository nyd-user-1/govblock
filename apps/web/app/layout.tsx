import type { Metadata } from "next"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { siteConfig } from "@/lib/config"
import { ORIGIN_TRIALS } from "@/lib/origin-trials"
import { fontVariables } from "@/lib/fonts"
import { SiteFooter } from "@/components/site-footer"
import { railScript } from "@/lib/rail-script"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { JurisdictionProvider } from "@/lib/policy/jurisdiction"
import {
  EMBED_SCRIPT,
  EMBED_STYLE,
  SCOPE_SCRIPT,
  SCOPE_STYLE,
} from "@/lib/policy/scope-script"
import { ScopeGuard } from "@/components/scope-guard"
import { ScopeReady } from "@/components/scope-ready"
import { AssistPanelProvider } from "@/lib/assist-panel"
import { PageRise } from "@/components/page-rise"
import { DevInspector } from "@/components/dev/inspector"
import { AssistPanel, AssistShell } from "@/components/assist-panel"
import { CardGateProvider } from "@/components/card-gate"
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
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        fontVariables,
        "[--header-height:calc(var(--spacing)*14)] lg:[--header-height:calc(var(--spacing)*16)]"
      )}
    >
      <head>
        {ORIGIN_TRIALS.map((trial) => (
          <meta key={trial.origin + trial.feature} httpEquiv="origin-trial" content={trial.token} />
        ))}
        {/* Before first paint: which jurisdiction this document is about to be
            for, and the rule that keeps Congress off a Texas reader's screen
            until the client has taken over. */}
        <script dangerouslySetInnerHTML={{ __html: SCOPE_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: SCOPE_STYLE }} />
        {/* Inside a frame — /create opening a record in place — the document
            is the page and nothing else: no site header, no footer. */}
        <script dangerouslySetInnerHTML={{ __html: EMBED_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: EMBED_STYLE }} />
        {/* The rails as this browser last left them, before anything is laid out. */}
        <script dangerouslySetInnerHTML={{ __html: railScript(false) }} />
      </head>
      <body className="group/body overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] xl:[--footer-height:calc(var(--spacing)*24)]">
        <NuqsAdapter>
          <ThemeProvider>
            <TooltipProvider delay={0}>
              <JurisdictionProvider>
                <CardGateProvider>
                  <AssistPanelProvider>
                    <ScopeReady />
                    <div
                      data-slot="layout"
                      className="group/layout relative z-10 flex min-h-svh flex-col bg-background has-data-[slot=designer]:h-svh has-data-[slot=designer]:overflow-hidden has-data-[slot=inbox]:h-svh has-data-[slot=inbox]:overflow-hidden"
                    >
                      <SiteHeader />
                      {/* The chat drawer is part of this shell (Brendan, 2026-09-07): it
                  lives outside the routed pages and survives every navigation. */}
                      <AssistShell>
                        <main
                          data-scope-content
                          className="flex min-h-0 flex-1 flex-col"
                        >
                          {/* The gate (Brendan, 2026-09-13): any page whose scope the reader may not open sits blurred under a card with the two ways on. */}
                          <ScopeGuard>
                            <PageRise>{children}</PageRise>
                          </ScopeGuard>
                        </main>
                      </AssistShell>
                      <SiteFooter />
                    </div>
                    <AssistPanel />
                    {/* Ours won (Brendan, 2026-09-16): @react-trace/kit is
                        uninstalled and only this inspector remains, resolving a
                        real file:line through /api/dev-locate. It draws nothing
                        until the long ⌘C summons it, and next.config aliases it
                        to an empty stub in production. */}
                    {process.env.NODE_ENV === "development" && <DevInspector />}
                  </AssistPanelProvider>
                </CardGateProvider>
              </JurisdictionProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
