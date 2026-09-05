import * as React from "react"

// shadcn's component-preview frame, class for class — the rounded box the
// docs show a component in — so a block on our pages sits the way one sits
// in theirs, at 32px all round so the content sits centred (Brendan,
// 2026-09-05). The data tables, the committee cards, and the Bills and Votes
// lists all render inside it.
export function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="component-preview" data-not-typeset="true" className="group relative mt-4 mb-12 flex flex-col overflow-hidden rounded-2xl border">
      <div data-slot="preview" dir="ltr">
        <div
          data-align="start"
          data-chromeless="false"
          className="preview relative flex h-auto w-full items-start justify-center p-8 data-[align=center]:items-center data-[align=end]:items-start data-[align=start]:items-start data-[chromeless=true]:h-auto data-[chromeless=true]:p-0 sm:data-[align=end]:items-end"
        >
          <div className="w-full">{children}</div>
        </div>
      </div>
    </div>
  )
}
