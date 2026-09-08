import Link from "next/link"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { LobbyingList } from "@/components/policy/lobbying-list"
import { Button } from "@govblock/ui/components/ny4/button"

// The lobbying register, on the bills board's page (app/docs/bills/page.tsx):
// the title, Copy Page, the description, the shared search field and the record
// list. One list, paged, the way Bills and Members are one list.
//
// A registrant's own page carries what it filed on — the clients, the
// lobbyists, the issues and the bills.
const title = "Lobbying"
const description = "Every firm registered to lobby Congress, and who it is paid to speak for."
const previous = { name: "Finance", url: "/docs/money" }
const next = { name: "Roll call votes", url: "/docs/roll-call-votes" }

export const metadata = { title, description }

export default function LobbyingPage() {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full min-w-0 max-w-160 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between md:items-start">
                <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <div className="docs-nav flex items-center gap-2">
                  <div className="hidden sm:block">
                    <DocsCopyPage page={`# ${title}\n\n${description}`} url="https://govblock.app/docs/lobbying" />
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
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
            <LobbyingList />
          </div>
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
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
