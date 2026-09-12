"use client"

import * as React from "react"
import Link from "next/link"
import { LayoutGridIcon, ListIcon } from "lucide-react"

import { useLocal } from "@/lib/policy/use-local"
import { REGISTRY_ITEMS, REGISTRY_KINDS, type RegistryKind } from "@/lib/workspace/registry-items"
import { H2 } from "@/components/typeset"
import { Button } from "@govblock/ui/components/ny4/button"

// The components index in two views (Brendan, 2026-09-12): the cards, and a
// list like shadcn's /docs/components — every name, one line each. The
// choice is remembered in this browser. The data chip sits at the right of
// the title; nothing on a card says which primitives it stands on.

const PLURAL: Record<RegistryKind, string> = { Component: "Components", Card: "Cards", Hook: "Hooks", Library: "Libraries" }

export function ComponentsIndex() {
  const [view, setView] = useLocal<"cards" | "list">("44gov-docs:components-view", "cards")
  const kinds = REGISTRY_KINDS.filter((k) => REGISTRY_ITEMS.some((i) => i.kind === k))
  return (
    <>
      <div data-not-typeset="true" className="mt-2 flex items-center justify-end gap-1">
        <Button variant={view === "cards" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="Cards" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
          <LayoutGridIcon />
        </Button>
        <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="size-8" aria-label="List" aria-pressed={view === "list"} onClick={() => setView("list")}>
          <ListIcon />
        </Button>
      </div>
      {kinds.map((kind) => {
        const rows = REGISTRY_ITEMS.filter((i) => i.kind === kind).sort((a, b) => a.title.localeCompare(b.title))
        return (
          <section key={kind} className="mt-10 first:mt-6">
            <H2 id={PLURAL[kind].toLowerCase()}>{PLURAL[kind]}</H2>
            {view === "cards" ? (
              <div data-not-typeset="true" className="mt-6 grid gap-4 sm:grid-cols-2">
                {rows.map((item) => (
                  <Link key={item.name} href={`/docs/components/${item.name}`} className="group flex flex-col gap-1.5 rounded-xl border p-5 no-underline transition-colors hover:bg-accent/50">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="underline-offset-4 group-hover:underline">{item.title}</span>
                      {item.data && <span className="ml-auto rounded-full border px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase">data</span>}
                    </span>
                    <span className="text-sm text-muted-foreground">{item.what}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <ul data-not-typeset="true" className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {rows.map((item) => (
                  <li key={item.name} className="border-b border-border/60 py-2.5">
                    <Link href={`/docs/components/${item.name}`} className="flex items-baseline gap-2 no-underline">
                      <span className="font-medium underline-offset-4 hover:underline">{item.title}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{item.what}</span>
                      {item.data && <span className="rounded-full border px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase">data</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}
