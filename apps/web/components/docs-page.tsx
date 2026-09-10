import Link from "next/link"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { Sidebar, SidebarContent } from "@govblock/ui/components/ny4/sidebar"
import { Button } from "@govblock/ui/components/ny4/button"

// The docs page shell /docs/bills, /docs/committees and /docs/directory each
// carry a copy of: title, Copy Page, prev/next, description, the prose column,
// and the rail. Written down once here for the pages added after them — the
// same markup and the same classNames, moved rather than redesigned.

export type DocsLink = { name: string; url: string }

export function DocsPage({ title, description, slug, previous, next, rail, children }: { title: string; description: string; slug: string; previous: DocsLink; next: DocsLink; rail?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between md:items-start">
                <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <div className="docs-nav flex items-center gap-2">
                  <div className="hidden sm:block">
                    <DocsCopyPage page={`# ${title}\n\n${description}`} url={`https://govblock.app${slug}`} />
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" asChild>
                      <Link href={previous.url}>
                        <IconArrowLeft />
                        <span className="sr-only">Previous</span>
                      </Link>
                    </Button>
                    <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" asChild>
                      <Link href={next.url}>
                        <span className="sr-only">Next</span>
                        <IconArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">{description}</p>
            </div>
          </div>
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">{children}</div>
          <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
            <Button variant="secondary" size="sm" className="shadow-none" asChild>
              <Link href={previous.url}>
                <IconArrowLeft /> {previous.name}
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
              <Link href={next.url}>
                {next.name} <IconArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {/* The right rail is the left rail, mirrored (Brendan, 2026-09-10): the
          same sticky offset, the same height, the same widths and the same
          hairline — moved to the inner edge — and the content padded away from
          it on the other side. Only the breakpoint differs, because a narrow
          window drops this rail before it drops the navigation. */}
      <Sidebar
        side="right"
        collapsible="none"
        className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 ml-auto hidden h-[calc(100svh-10rem)] overflow-hidden overscroll-none bg-transparent [--sidebar-menu-width:--spacing(56)] xl:flex"
      >
        <div className="absolute top-12 bottom-0 left-2 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] xl:flex" />
        {/* py-1: the scroller clipped the first card's top edge and shadow into a blurred line (Brendan, 2026-09-06). */}
        {/* mr-8: the left rail sits 32px off the viewport, and this one has a
            scroll gutter eating the difference, so the margin is stated rather
            than left to the scrollbar (Brendan, 2026-09-10). */}
        <SidebarContent className="scrollbar-none mr-8 ml-auto w-(--sidebar-menu-width) scroll-fade gap-6 overflow-x-hidden py-1">
          {rail}
          <PublicRail />
        </SidebarContent>
      </Sidebar>
    </div>
  )
}
