"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, Globe2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { AgentDisclosure } from "@/components/agents/agent-disclosure"
import { SPRING_SWAP } from "@/lib/ease"
import { outletsFor, type Outlet } from "@/lib/news/outlets"
import { cn } from "@govblock/ui/lib/utils"

// What a briefing was read out of (2026-09-13): the outlet's favicon, the
// story's title as a link, and the outlet's name, in a list that scrolls
// inside a fixed height. The agents' own footer shows a domain from the
// citation's URL, but a brief cites every story at its page here,
// /news/{state}/{id}, so the outlet has to be looked up.

type Cited = { title: string; url: string }

const STORY = /^\/news\/[a-z-]+\/(\d+)(?:[/?#]|$)/i

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

const storyId = (url: string) => Number(url.match(STORY)?.[1] ?? 0)

/** The typeset column's prose link (public/typeset.css), for rows that sit outside it. */
const PROSE_LINK =
  "font-medium text-inherit underline decoration-current/30 transition-colors hover:decoration-current focus-visible:rounded-[0.125em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

function Favicon({ domain }: { domain: string | null }) {
  const [failed, setFailed] = React.useState<string | null>(null)
  if (!domain || failed === domain) return <Globe2 className="size-3.5" />
  return (
    // biome-ignore lint/performance/noImgElement: a cross-site favicon, 16px, no optimisation to gain.
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      width={16}
      height={16}
      referrerPolicy="no-referrer"
      onError={() => setFailed(domain)}
      className="size-4 rounded-sm object-contain"
    />
  )
}

export function BriefSources({ sources }: { sources: Cited[] }) {
  const reduce = useReducedMotion() ?? false
  const contentId = React.useId()
  const [open, setOpen] = React.useState(false)
  const [outlets, setOutlets] = React.useState<Record<number, Outlet>>({})

  const ids = sources.map((s) => storyId(s.url)).filter((n) => n > 0)
  const key = ids.join(",")
  React.useEffect(() => {
    if (!key) return
    let alive = true
    outletsFor(key.split(",").map(Number))
      .then((found) => {
        if (alive) setOutlets(found)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [key])

  if (!sources.length) return null

  const rows = sources.map((s) => {
    const outlet = outlets[storyId(s.url)]
    const domain = outlet?.domain ?? hostOf(s.url)
    return { ...s, domain, outlet: outlet?.name ?? domain }
  })

  return (
    <div className="-mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        className="group inline-flex min-h-7 items-center gap-2 rounded-md px-1.5 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="flex -space-x-1.5">
          {rows.slice(0, 3).map((row, i) => (
            <span
              key={`${i}-${row.url}`}
              className="grid size-6 place-items-center rounded-full bg-background text-muted-foreground ring-2 ring-background"
            >
              <Favicon domain={row.domain} />
            </span>
          ))}
        </span>
        <span className="tabular-nums">
          {rows.length} {rows.length === 1 ? "source" : "sources"}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
          className="text-muted-foreground/50 group-hover:text-muted-foreground"
        >
          <ChevronDown className="size-3" />
        </motion.span>
      </button>

      <AgentDisclosure id={contentId} open={open}>
        <ol className="mt-2 grid max-h-[280px] gap-0.5 overflow-y-auto overscroll-contain rounded-xl bg-muted p-2">
          {rows.map((row, i) => {
            const external = /^https?:/.test(row.url)
            const title = cn("min-w-0 truncate text-foreground/80", PROSE_LINK)
            return (
              <li key={`${i}-${row.url}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs">
                <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center text-muted-foreground">
                  <Favicon domain={row.domain} />
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {external ? (
                    <a href={row.url} target="_blank" rel="noreferrer noopener" className={title}>
                      {row.title}
                    </a>
                  ) : (
                    <Link href={row.url} className={title}>
                      {row.title}
                    </Link>
                  )}
                  {row.outlet ? <span className="min-w-0 truncate text-muted-foreground/60">{row.outlet}</span> : null}
                </span>
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-foreground/[0.05] text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
              </li>
            )
          })}
        </ol>
      </AgentDisclosure>
    </div>
  )
}
