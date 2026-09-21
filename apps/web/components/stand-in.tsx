"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CompassIcon, FlaskConicalIcon } from "lucide-react"

import { inLab } from "@/lib/lab"
import { SEARCH_PAGES } from "@/lib/search-pages"
import { openCommandMenu } from "@/components/command-menu"
import { SubscribeField } from "@/components/subscribe-field"
import { Button } from "@govblock/ui/components/nova/button"

// What stands where a page is not (Brendan, 2026-09-21): the card the scope gate wears (components/scope-guard.tsx)
// — its width, its border and shadow, its place under the header — with nothing blurred behind it, because there is
// no page to blur. Two of them. A route in the lab is not served in production: scripts/routes/prune-lab.mjs writes
// a page in its place that draws LabGatePage, which says so and takes an address for word of its opening ("this
// feature is still in the lab but subscribe for more updates"). Any other address that answers to nothing gets
// NotFoundCard, from app/not-found.tsx, where the framework's bare "404" stood.

function Card({ icon, title, children, actions }: { icon: React.ReactNode; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div data-not-typeset="true" className="flex min-h-[60vh] flex-1 justify-center px-4 pt-16 pb-16">
      <div className="flex h-fit w-full max-w-lg flex-col gap-4 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg">
        <h1 className="mt-0 flex items-center gap-3 text-xl font-semibold [&_svg]:size-6 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
          {icon}
          <span>{title}</span>
        </h1>
        {children}
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  )
}

function Back() {
  const router = useRouter()
  return (
    <Button variant="outline" onClick={() => router.back()}>
      Back
    </Button>
  )
}

/** The menu's name for the lab route the address is under — "Research" for /research/hr1 — where the menu has one. */
function labName(pathname: string): string | null {
  const page = SEARCH_PAGES.filter((p) => inLab(p.href) && (pathname === p.href || pathname.startsWith(`${p.href}/`))).sort((a, b) => b.href.length - a.href.length)[0]
  return page?.name ?? null
}

export function LabGatePage() {
  const pathname = usePathname()
  const name = labName(pathname)
  return (
    <Card
      icon={<FlaskConicalIcon />}
      title={name ? `${name} is still in the lab` : "This page is still in the lab"}
      actions={
        <>
          <Back />
          <Button render={<Link href="/" />} nativeButton={false}>
            Home
          </Button>
        </>
      }
    >
      <p className="text-base leading-relaxed text-muted-foreground">It is being built and is not open yet.</p>
      <SubscribeField id="lab-subscribe" label="Word when it opens, by email." topics={[`lab:/${pathname.split("/").filter(Boolean)[0] ?? ""}`]} />
    </Card>
  )
}

export function NotFoundCard() {
  const pathname = usePathname()
  return (
    <Card
      icon={<CompassIcon />}
      title="No page at this address"
      actions={
        <>
          <Back />
          <Button variant="outline" onClick={() => openCommandMenu()}>
            Search
          </Button>
          <Button render={<Link href="/" />} nativeButton={false}>
            Home
          </Button>
        </>
      }
    >
      <p className="text-base leading-relaxed text-muted-foreground">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm break-all text-foreground">{pathname}</code> answers to nothing here. The address may be mistyped, or the page may have moved.
      </p>
    </Card>
  )
}
