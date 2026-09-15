"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EditorContent, Extension, useEditor, type JSONContent } from "@tiptap/react"
import { history, redo, undo } from "@tiptap/pm/history"
import { Step } from "@tiptap/pm/transform"
import { TextSelection } from "@tiptap/pm/state"
import { keymap } from "@tiptap/pm/keymap"
import { BookOpenIcon, CheckIcon, CopyIcon, FolderIcon, HighlighterIcon, ListOrderedIcon, ScrollTextIcon } from "lucide-react"

import { createCommit, forkAddress, type Fork } from "@/lib/policy/forks"
import type { Bill } from "@/lib/policy/types"
import { amendmentText, diffDocs, instructions, type Amendment, type Citation, type Convention, type Run } from "@/lib/typeset/amend"
import { usePaneNoteSetter } from "@/lib/typeset/pane-note"
import { readLocalDraft, useAutosave, type SaveStatus } from "@/lib/typeset/use-autosave"
import { billWork } from "@/lib/xml/address"
import { workHref } from "@/lib/xml/library"
import { CiteDecorations, useCitations } from "@/components/workspace/typeset-cite-layer"
import { ContextMarkers, TypesetContextPane, type Focus } from "@/components/workspace/typeset-context"
import { TypesetFrame } from "@/components/workspace/typeset-frame"
import { ForkRedline, forkMarked, forkRedlineKey, type ForkSpec } from "@/components/workspace/typeset-redline"
import { InlineMenu, InlineMenuPopup, type Trigger } from "@/components/workspace/typeset-inline-menu"
import { AiLayer } from "@/components/workspace/typeset-ai-menu"
import { StaticToolbar } from "@/components/workspace/typeset-toolbar"
import { XmlMarkKeys } from "@/components/workspace/typeset-xml-toolbar"
import { TypesetForkChrome } from "@/components/workspace/typeset-file-chrome"
import { ToolbarButton } from "@/components/plate/ui/toolbar"
import { PaneAside } from "@/components/policy/pane-aside"
import { XML_EXTENSIONS } from "@/components/workspace/typeset-xml-extensions"
import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

import "./typeset-xml-reader.css"
import "./typeset-fork.css"

// The Fork view (window 5, 2026-09-14): a reader's fork of a published unit,
// a section, a subsection or a printing, edited in the Tiptap editor on the
// same USLM schema the XML reader draws. As the fork changes, the engine
// (lib/typeset/amend.ts) diffs it against the dated base it was forked from
// and writes the amendment beside it in the jurisdiction's convention. A
// commit stores the fork's document.
//
// One text (Brendan, 2026-09-14): the reader edits the fork with the redline
// drawn on it, on by default and off from the toolbar; the Edit and Redline
// tabs are gone. The fork's own buttons lead the rich-text toolbar; the
// amendment and the in-context view are sidebars toggled beside it; which
// printing and as of when sit in the footer; `@` names a person and `/`
// opens the commands and references, typed in the text.
//
// Editing in place (2026-09-15): the XML view becomes this view on the
// reader's first keystroke. It opens on the fork's working document (saved as
// the reader types, lib/typeset/use-autosave.ts), and the keystrokes typed
// on the reader while the copy was being made are carried onto it.

export type ForkPayload = {
  fork: Fork
  base: { address: string; date: string; label: string | null; fidelity: string; coverage: number | null; json: JSONContent }
  head: { id: number; json: JSONContent } | null
  /** The working document saved since the last commit; the fork's owner only. */
  draft: { json: JSONContent; saved_at: string; parent_commit_id: number | null } | null
  commits: { id: number; message: string; description: string; author: string; created_at: string; parent_commit_id: number | null; doc_bytes: number | null }[]
  cite: Citation
}

const fmtDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })

const ForkHistory = Extension.create({
  name: "forkHistory",
  addProseMirrorPlugins: () => [history(), keymap({ "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo })],
})

type Panel = "amendment" | "context" | null

/** What the XML view hands over when editing begins: the edits made on the reader since the first keystroke, as steps over a document the size of the base, and where the reader was. */
export type Carry = { steps: unknown[]; size: number; selection: { anchor: number; head: number } | null; scrollId: string | null; scrollOffset: number }

/** Which text the fork opened on. */
type Start = { json: JSONContent; from: "local" | "draft" | "head" | "base" }

const SAVE_WORDS: Record<SaveStatus, string | null> = { idle: null, saving: "Saving…", saved: "Saved to My Files", failed: "Not saved yet, trying again" }

function RunText({ run, convention }: { run: Run; convention: Convention }) {
  if (run.op === "insert") return <span className={cn(convention.newMatter === "underscored" && "underline decoration-1 underline-offset-2", convention.newMatter === "italic" && "italic")}>{run.text}</span>
  if (run.op === "delete") return convention.omittedMatter === "brackets" ? <span>[{run.text}]</span> : <span className="line-through">{run.text}</span>
  return <>{run.text}</>
}

function Instructions({ amendment }: { amendment: Amendment | null }) {
  const [copied, setCopied] = React.useState(false)
  if (!amendment) return <Skeleton className="m-4 h-24 rounded-lg" />
  if (!amendment.instructions.length) return <p className="p-4 text-sm text-muted-foreground">No changes from the base.</p>
  return (
    <div className="relative p-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2"
        aria-label="Copy the amendment"
        onClick={() => {
          void navigator.clipboard?.writeText(amendmentText(amendment))
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <ol className="flex flex-col gap-5 pr-8 text-sm leading-relaxed">
        {amendment.instructions.map((ins, i) => (
          <li key={i}>
            <p className="whitespace-pre-wrap">{ins.text}</p>
            {ins.body && (
              <div className="mt-2 border-l-2 pl-3 font-serif text-[13px]">
                {ins.body.map((line, j) => (
                  <p key={j} style={{ paddingLeft: `${line.depth}rem` }}>
                    {line.runs.map((run, k) => (
                      <RunText key={k} run={run} convention={amendment.convention} />
                    ))}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function TypesetForkView({ forkId, carry, onCarried, active = true }: { forkId: number; /** The XML view's edits, read once the fork's editor holds its text. */ carry?: React.RefObject<Carry | null>; onCarried?: () => void; /** False while the XML view is still on screen over it: nothing is written to the footer. */ active?: boolean }) {
  const [data, setData] = React.useState<ForkPayload | null>(null)
  const [start, setStart] = React.useState<Start | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [panel, setPanel] = React.useState<Panel>("amendment")
  const [redlineOn, setRedlineOn] = React.useState(true)
  React.useEffect(() => {
    try {
      if (localStorage.getItem("typeset-fork-redline") === "off") setRedlineOn(false)
    } catch {}
  }, [])
  const toggleRedline = () =>
    setRedlineOn((on) => {
      try {
        localStorage.setItem("typeset-fork-redline", on ? "off" : "on")
      } catch {}
      return !on
    })
  // The tab and unit an `@` marker opened in the in-context view (window 6b).
  const [focus, setFocus] = React.useState<Focus | null>(null)
  const [amendment, setAmendment] = React.useState<Amendment | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [asking, setAsking] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [description, setDescription] = React.useState("")
  const specs = React.useRef<ForkSpec[]>([])
  const router = useRouter()
  const routerRef = React.useRef(router)
  routerRef.current = router
  // `@` or `/` typed in the text, while its menu is open.
  const [trigger, setTrigger] = React.useState<Trigger | null>(null)
  const menuKeys = React.useRef<((key: string) => boolean) | null>(null)

  const load = React.useCallback(() => {
    setFailed(null)
    return fetch(`/api/typeset/fork?id=${forkId}`)
      .then(async (r) => (r.ok ? (r.json() as Promise<ForkPayload>) : Promise.reject(new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? String(r.status)))))
      .then(async (body) => {
        // This browser's copy, when a save never reached the server since the commit it was edited from.
        const local = await readLocalDraft(forkId)
        const serverAt = body.draft ? Date.parse(body.draft.saved_at) : 0
        const next: Start =
          local && local.headId === (body.head?.id ?? null) && local.at > serverAt
            ? { json: local.json, from: "local" }
            : body.draft
              ? { json: body.draft.json, from: "draft" }
              : body.head
                ? { json: body.head.json, from: "head" }
                : { json: body.base.json, from: "base" }
        setData(body)
        setStart(next)
        setMessage(`Amend ${body.fork.label ?? body.fork.work}`)
      })
      .catch((error: Error) => setFailed(error.message))
  }, [forkId])
  React.useEffect(() => {
    void load()
  }, [load])

  const editor = useEditor(
    {
      extensions: [
        ...XML_EXTENSIONS,
        ForkHistory,
        ForkRedline,
        CiteDecorations.configure({ onOpen: (href) => routerRef.current.push(href) }),
        InlineMenu.configure({ onChange: setTrigger, onKey: (k) => menuKeys.current?.(k) ?? false }),
        ContextMarkers.configure({ onOpen: (m) => setFocus({ work: m.work, unit: m.unit, n: Date.now() }) }),
        XmlMarkKeys,
      ],
      editable: true, immediatelyRender: false, content: start?.json ?? null, enableInputRules: false, enablePasteRules: false },
    [data?.fork.id, data?.head?.id, start]
  )
  const save = useAutosave(start ? editor : null, data?.fork.id ?? null, data?.head?.id ?? null, { dirtyAtStart: start?.from === "local" })

  // The reader's keystrokes from the XML view, carried onto the fork once its editor holds the text (2026-09-15). The reader's document is the stored Expression the fork's base is, so the steps land where they were typed.
  const carried = React.useRef(false)
  React.useEffect(() => {
    if (!carry || carried.current || !editor || editor.isDestroyed || !editor.schema || !start || !data) return
    const handed = carry.current
    if (!handed) return
    carried.current = true
    let tr = editor.state.tr
    let whole = start.from === "base" && handed.size === editor.state.doc.content.size
    if (whole) {
      for (const json of handed.steps) {
        try {
          if (tr.maybeStep(Step.fromJSON(editor.schema, json)).failed) whole = false
        } catch {
          whole = false
        }
        if (!whole) break
      }
    }
    if (!whole) {
      tr = editor.state.tr
      setNotice(start.from === "base" ? "The first keystrokes could not be carried onto the copy; type them again." : "This printing already had a copy in My Files; it opened with the changes saved in it.")
    } else if (handed.selection) {
      const clamp = (n: number) => Math.max(0, Math.min(n, tr.doc.content.size))
      try {
        tr.setSelection(TextSelection.create(tr.doc, clamp(handed.selection.anchor), clamp(handed.selection.head)))
      } catch {}
    }
    if (tr.docChanged || tr.selectionSet) editor.view.dispatch(tr)
    // Where the reader was reading: the same unit at the same height.
    const el = handed.scrollId ? scroller.current?.querySelector<HTMLElement>(`[id="${CSS.escape(handed.scrollId)}"]`) : null
    if (el && scroller.current) scroller.current.scrollTop += el.getBoundingClientRect().top - scroller.current.getBoundingClientRect().top - handed.scrollOffset
    editor.view.focus()
    onCarried?.()
  }, [carry, editor, start, data, onCarried])
  // The fork's citations, found, resolved as of its base's date and decorated (window 6).
  useCitations(data ? editor : null, data ? { jurisdiction: data.cite.jurisdiction, work: data.cite.work, at: data.base.date.slice(0, 10), citing: data.base.address } : null)

  // The amendment, rewritten as the fork changes.
  React.useEffect(() => {
    // The editor made with immediatelyRender off can arrive before its schema is (2026-09-14, fork 265 threw on nodeFromJSON of null); the effect runs again when it is whole.
    if (!editor || !data || editor.isDestroyed || !editor.schema) return
    const base = editor.schema.nodeFromJSON(data.base.json)
    const head = data.head ? editor.schema.nodeFromJSON(data.head.json) : base
    let timer = 0
    const run = () => {
      if (editor.isDestroyed) return
      const doc = editor.state.doc
      const diff = diffDocs(base, doc)
      setAmendment(instructions(diff, data.cite))
      setDirty(!doc.eq(head))
      specs.current = forkMarked(diff)
      drawRef.current()
    }
    run()
    const onUpdate = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 250)
    }
    editor.on("update", onUpdate)
    return () => {
      editor.off("update", onUpdate)
      window.clearTimeout(timer)
    }
  }, [editor, data])

  // The redline drawn on the fork, or cleared; tried again while the view mounts.
  const drawRedline = React.useCallback(() => {
    if (!editor || editor.isDestroyed) return
    let tries = 0
    const attempt = () => {
      if (editor.isDestroyed) return
      try {
        editor.view.dispatch(editor.state.tr.setMeta(forkRedlineKey, redlineOn ? specs.current : []).setMeta("addToHistory", false))
      } catch {
        if (tries++ < 20) window.setTimeout(attempt, 250)
      }
    }
    attempt()
  }, [editor, redlineOn])
  const drawRef = React.useRef(drawRedline)
  drawRef.current = drawRedline
  React.useEffect(() => drawRedline(), [drawRedline])

  // Which fork, as of when, and its address: in the footer after the size line (Brendan, 2026-09-14).
  const setMeta = usePaneNoteSetter("meta")
  React.useEffect(() => {
    if (!setMeta || !data || !active) return
    setMeta(
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 font-medium text-foreground">{data.fork.label ?? data.fork.work}</span>
        <span className="shrink-0">
          as of {fmtDay(data.base.date)}
          {data.fork.commits ? ` · ${data.fork.commits} commit${data.fork.commits === 1 ? "" : "s"}` : ""}
        </span>
        <code className="max-w-96 truncate font-mono text-[11px]">{data.fork.work}</code>
      </span>
    )
    return () => setMeta(null)
  }, [setMeta, data, active])

  const commit = async () => {
    if (!editor || !data) return
    setSaving(true)
    const made = await createCommit({ fork_id: data.fork.id, parent_document_id: null, parent_commit_id: data.head?.id ?? null, message: message.trim(), description: description.trim(), doc: editor.getJSON() })
    setSaving(false)
    if (!made) {
      setFailed("The commit was refused: only the fork's owner can commit to it.")
      return
    }
    setAsking(false)
    setDescription("")
    await load()
  }

  if (failed && !data) return <p className="p-8 text-sm text-muted-foreground">{failed}</p>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StaticToolbar
        xml={{ editor }}
        end={
          <>
            <ToolbarButton tooltip={redlineOn ? "Redline on" : "Redline off"} pressed={redlineOn} onClick={toggleRedline}>
              <HighlighterIcon />
            </ToolbarButton>
            <ToolbarButton tooltip="Amendment" pressed={panel === "amendment"} onClick={() => setPanel((p) => (p === "amendment" ? null : "amendment"))}>
              <ListOrderedIcon />
            </ToolbarButton>
            <ToolbarButton tooltip="In context" pressed={panel === "context"} disabled={!data} onClick={() => setPanel((p) => (p === "context" ? null : "context"))}>
              <BookOpenIcon />
            </ToolbarButton>
            {SAVE_WORDS[save.status] && <span className="px-1 text-xs whitespace-nowrap text-muted-foreground">{SAVE_WORDS[save.status]}</span>}
            <Button size="sm" disabled={!dirty || !data} className="ml-1 h-7 bg-[#1f883d] text-xs text-white hover:bg-[#1a7f37]" onClick={() => setAsking(true)}>
              Commit…
            </Button>
          </>
        }
      />
      {failed && <p className="shrink-0 border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">{failed}</p>}
      {notice && <p className="shrink-0 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">{notice}</p>}
      <div className="flex min-h-0 flex-1">
        <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
          {!data && (
            <div className="flex flex-col gap-2 p-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          )}
          <div className={cn("uslm-doc amend-edit", redlineOn && "redline-on")}>
            <EditorContent editor={editor} />
          </div>
          {data && <AiLayer editor={editor} container={scroller} state={data.fork.state} />}
        </div>
        {panel === "context" && data && <TypesetContextPane editor={editor} forkWork={data.fork.work ?? data.cite.work} base={data.base} cite={data.cite} focus={focus} onFocus={setFocus} onClose={() => setPanel(null)} />}
        {panel === "amendment" && (
          <PaneAside title={`Amendment${amendment ? ` · ${amendment.instructions.length}` : ""}`} onClose={() => setPanel(null)} className="hidden w-[26rem] lg:flex" bodyClassName="py-0">
            <Instructions amendment={data ? amendment : null} />
          </PaneAside>
        )}
      </div>

      {trigger && editor && data && <InlineMenuPopup editor={editor} trigger={trigger} jurisdiction={data.cite.jurisdiction} state={data.fork.state} keys={menuKeys} />}

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Commit changes</DialogTitle>
            <DialogDescription>The fork&apos;s text becomes a commit in My Files. The published law is never altered.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Commit message</span>
              <input value={message} onChange={(e) => setMessage(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Extended description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add an optional extended description…" className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button disabled={!message.trim() || saving} className="bg-[#1f883d] text-white hover:bg-[#1a7f37]" onClick={() => void commit()}>
              Commit changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ForkRail({ baseAddress, baseLabel, myFiles }: { baseAddress: string; baseLabel: string; myFiles: string }) {
  const router = useRouter()
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Fork</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => router.push(myFiles)}>
                <FolderIcon />
                <span className="flex-1 truncate">My Files</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => router.push(workHref(baseAddress))}>
                <ScrollTextIcon />
                <span className="flex-1 truncate">{baseLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

/** /workspace/typeset/fork/<id>: the Fork view in Typeset's frame, under My Files. */
export function TypesetForkPage({ forkId, label, baseAddress, baseLabel, myFiles }: { forkId: number; label: string; baseAddress: string; baseLabel: string; myFiles: string }) {
  return (
    <TypesetFrame rail={<ForkRail baseAddress={baseAddress} baseLabel={baseLabel} myFiles={myFiles} />} crumbs={[{ label: "My Files", href: myFiles }, { label }]}>
      {/* The Git view's file row over the fork (Brendan, 2026-09-14); the fork draws the toolbar under it. */}
      <TypesetForkChrome label={label} baseAddress={baseAddress} baseLabel={baseLabel} myFiles={myFiles}>
        <TypesetForkView forkId={forkId} />
      </TypesetForkChrome>
    </TypesetFrame>
  )
}

/** A bill's Fork view: the reader's fork of its printing, made on first open and reused after. */
export function TypesetBillFork({ bill }: { bill: Bill | null }) {
  const [forkId, setForkId] = React.useState<number | null>(null)
  const [failed, setFailed] = React.useState(false)
  const billId = bill?.bill_id
  React.useEffect(() => {
    if (!bill) return
    let live = true
    const work = billWork(bill)
    if (!work) {
      setFailed(true)
      return
    }
    void forkAddress(work, { bill_id: bill.bill_id, title: bill.title }).then((fork) => {
      if (!live) return
      if (fork) setForkId(fork.id)
      else setFailed(true)
    })
    return () => {
      live = false
    }
    // One fork per bill; the bill object is re-fetched without changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId])
  if (failed) return <p className="p-8 text-sm text-muted-foreground">This bill&apos;s printings are not in the XML store yet, so there is no dated base to fork.</p>
  if (!forkId) return <Skeleton className="m-8 h-40 rounded-xl" />
  return <TypesetForkView forkId={forkId} />
}
