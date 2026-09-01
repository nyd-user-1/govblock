"use client"

import * as React from "react"
import Link from "next/link"
import { MoreVertical, Pin, PinOff } from "lucide-react"

import { useLocal } from "@/lib/policy/use-local"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@govblock/ui/components/nova/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"
import { Field, FieldLabel } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"
import { Textarea } from "@govblock/ui/components/nova/textarea"

// Ported from livingston-v3 components/policy/project-card.tsx (the Alert
// toast is inert here — no sonner). The Claude-projects card, as the reference Brendan measured: every card the
// same size whatever its content, two to a row at a 24px gap, the title
// top-left and one meta line bottom-left, generous padding, a subtle border
// and a ⋮ menu that appears on hover.
//
// Nothing here is auto-sized by content. A grid of cards that each grew to
// their own text is what the reference is deliberately not.

export function ProjectGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="project-grid"
      className={cn("grid grid-cols-1 gap-6 md:grid-cols-2", className)}
      {...props}
    />
  )
}

export type ProjectCardMenu = {
  /** Pinned cards float to the front of their group. */
  pinned: boolean
  onPin: () => void
  /** The feed this card subscribes to. */
  feedHref: string
  /** Opens the details editor. */
  onEdit: () => void
}

export function ProjectCard({
  href,
  media,
  title,
  meta,
  note,
  menu: menuProp,
  feedHref,
  className,
}: {
  href: string
  media?: React.ReactNode
  title: string
  /** The one line under the title. In the reference this is all there is. */
  meta: React.ReactNode
  /** A note the reader added in Edit details. */
  note?: string
  menu?: ProjectCardMenu
  /** A feed alone: the menu shows, Pin and Edit details are inert. */
  feedHref?: string
  className?: string
}) {
  const menu = menuProp ?? (feedHref ? { pinned: false, onPin: () => {}, onEdit: () => {}, feedHref } : undefined)
  return (
    <div
      data-slot="project-card"
      className={cn(
        "group/project relative flex h-[132px] flex-col justify-between rounded-xl border bg-card p-6 transition-colors hover:bg-accent/40",
        className
      )}
    >
      <Link
        href={href}
        title={title}
        className="absolute inset-0 z-0 rounded-xl no-underline"
      >
        <span className="sr-only">{title}</span>
      </Link>
      <div className="pointer-events-none relative z-1 flex min-w-0 items-start gap-3">
        {media}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
          {note ? (
            <span className="truncate text-xs text-muted-foreground">
              {note}
            </span>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none relative z-1 truncate text-xs text-muted-foreground tabular-nums">
        {meta}
      </div>
      {menu ? (
        <div
          className={cn(
            "absolute top-3 right-3 z-10 transition-opacity",
            // Visible on hover and on keyboard focus; pinned cards keep the
            // pin visible so the state is legible without hovering.
            menu.pinned
              ? "opacity-100"
              : "opacity-0 group-hover/project:opacity-100 focus-within:opacity-100"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${title} actions`}
                />
              }
            >
              {menu.pinned ? (
                <Pin className="fill-current" />
              ) : (
                <MoreVertical />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={menu.onPin}>
                {menu.pinned ? <PinOff /> : <Pin />}
                {menu.pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={menu.onEdit}>
                Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={
                  <a href={menu.feedHref} target="_blank" rel="noreferrer" />
                }
              >
                Subscribe
              </DropdownMenuItem>
              <DropdownMenuItem>Alert</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  )
}

export type ProjectDetails = { label?: string; note?: string }

/**
 * Per-card content the reader owns: a label that renames the card and a note
 * under it. The thing itself is not editable — a committee is a committee —
 * so this is content only, and it lives in localStorage until there are
 * accounts.
 */
export function useProjectDetails(scope: string) {
  const [pinned, setPinned] = useLocal<string[]>(
    `livingston:pinned:${scope}`,
    []
  )
  const [details, setDetails] = useLocal<Record<string, ProjectDetails>>(
    `livingston:details:${scope}`,
    {}
  )
  const togglePin = React.useCallback(
    (id: string) =>
      setPinned((current) =>
        current.includes(id)
          ? current.filter((value) => value !== id)
          : [id, ...current]
      ),
    [setPinned]
  )
  return { pinned, togglePin, details, setDetails }
}

export function EditDetailsDialog({
  open,
  onOpenChange,
  id,
  fallbackLabel,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  id: string | null
  fallbackLabel: string
  value: ProjectDetails
  onSave: (next: ProjectDetails) => void
}) {
  const [label, setLabel] = React.useState(value.label ?? "")
  const [note, setNote] = React.useState(value.note ?? "")

  React.useEffect(() => {
    setLabel(value.label ?? "")
    setNote(value.note ?? "")
  }, [id, value.label, value.note])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            Your label and note for {fallbackLabel}. This changes what you see,
            not the record — kept in this browser until there are accounts.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="project-label">Label</FieldLabel>
            <Input
              id="project-label"
              value={label}
              placeholder={fallbackLabel}
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-note">Note</FieldLabel>
            <Textarea
              id="project-note"
              value={note}
              rows={3}
              placeholder="Why you are watching this"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline">Cancel</Button>}
          ></DialogClose>
          <Button
            onClick={() => {
              onSave({
                label: label.trim() || undefined,
                note: note.trim() || undefined,
              })
              onOpenChange(false)
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
