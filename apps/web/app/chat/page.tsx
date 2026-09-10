import * as React from "react"

import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"

import { ChatView } from "./chat-view"

// /chat: the one chat, at the directory family's width, with the Filer's
// starters first. The column is the bills page's (app/docs/bills/page.tsx),
// without its prose cap, and the composer pins to the column's bottom.
const title = "Chat"
const description = "Apply for New York benefits with the Filer, or ask the Clerk about a bill, a vote, a hearing or a committee."

export const metadata = { title, description }

export default function ChatPage() {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between md:items-start">
              <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              <div className="docs-nav flex items-center gap-2">
                <div className="hidden sm:block">
                  <DocsCopyPage page={`# ${title}\n\n${description}`} url="https://gov.nysgpt.com/chat" />
                </div>
              </div>
            </div>
            <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">{description}</p>
          </div>
          <div className="flex min-h-[60svh] w-full flex-1 flex-col">
            <React.Suspense fallback={null}>
              <ChatView />
            </React.Suspense>
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
