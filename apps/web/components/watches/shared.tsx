"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarClockIcon, FileTextIcon, GavelIcon, LandmarkIcon, ListIcon, MailIcon, NewspaperIcon, ScrollTextIcon, VoteIcon, WorkflowIcon, type LucideIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import type { Template } from "@/lib/watches/templates"

// The pieces the Watches pages share: the account hook, the icon tiles, the
// frame the create flow sits in (a label on the left, a card in the middle,
// the steps on the right, the way the Cloudflare dashboard's create flow is
// drawn), and the empty state.

export type Account = { id?: string; name?: string | null; email?: string | null; image?: string | null } | null

export function useAccount() {
  const [account, setAccount] = React.useState<Account>(null)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    let live = true
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { user?: NonNullable<Account> } | null) => {
        if (!live) return
        setAccount(s?.user?.email || s?.user?.name ? s.user : null)
        setReady(true)
      })
      .catch(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return { account, ready }
}

export const ICONS: Record<Template["icon"], LucideIcon> = {
  bill: ScrollTextIcon,
  committee: LandmarkIcon,
  text: FileTextIcon,
  vote: VoteIcon,
  digest: NewspaperIcon,
  letter: MailIcon,
  clock: CalendarClockIcon,
  blank: WorkflowIcon,
  list: ListIcon,
}

export function IconTile({ icon: Icon, className, tone }: { icon: LucideIcon; className?: string; tone?: string }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background shadow-xs", className)}>
      <Icon className={cn("size-5", tone ?? "text-foreground")} />
    </span>
  )
}

/** A row in the "Make something new" card: an icon tile, a title, a line, an arrow on hover. */
export function OptionRow({
  icon,
  title,
  description,
  onClick,
  href,
  badge,
  dot,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  onClick?: () => void
  href?: string
  badge?: React.ReactNode
  dot?: "on" | "off"
  className?: string
}) {
  const inner = (
    <>
      <span className="relative">
        <IconTile icon={icon} />
        {dot && <span className={cn("absolute -top-1 -right-1 size-2.5 rounded-full ring-2 ring-background", dot === "on" ? "bg-green-500" : "bg-muted-foreground/50")} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-medium">{title}</span>
        {description && <span className="truncate text-sm text-muted-foreground">{description}</span>}
      </span>
      {badge}
      <span className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">→</span>
    </>
  )
  const cls = cn("group flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/50", className)
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/**
 * The create flow's frame: the steps, then the card. Inside DocsPage since 2026-09-20 (Brendan): the flow's label
 * is the shell's title now, and the steps run in a row over the card, where a column either side of it once held them.
 */
export function CreateFrame({ steps, current, children }: { steps: string[]; current: number; children: React.ReactNode }) {
  return (
    <div data-not-typeset="true" className="flex flex-col gap-6">
      <ol className="m-0 flex list-none flex-wrap gap-4 p-0 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={cn("m-0 flex items-center gap-2 p-0", i === current ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("size-2 rounded-full border", i === current ? "border-foreground bg-foreground" : i < current ? "border-foreground" : "border-muted-foreground/60")} />
            {s}
          </li>
        ))}
      </ol>
      {children}
    </div>
  )
}

export function CreateCard({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="p-6">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex flex-col gap-3">{children}</div>
      </div>
      {footer && <div className="flex items-center justify-between border-t bg-muted/40 px-6 py-4">{footer}</div>}
    </div>
  )
}

export function Gate({ what }: { what: string }) {
  return (
    <div className="container-wrapper">
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <GavelIcon className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{what} are yours. Sign in to see them.</p>
        <Button render={<Link href="/sign-in" />} size="sm">
          Sign in
        </Button>
      </div>
    </div>
  )
}

export const ago = (iso: string | null | undefined) => {
  if (!iso) return "never"
  const s = (Date.now() - new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`).getTime()) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
