"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EditorContent, Extension, useEditor, type JSONContent } from "@tiptap/react"
import { history, redo, undo } from "@tiptap/pm/history"
import { keymap } from "@tiptap/pm/keymap"
import { DOMSerializer, type Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { CheckIcon, CopyIcon, FolderIcon, ScrollTextIcon } from "lucide-react"

import { createCommit, forkAddress, type Fork } from "@/lib/policy/forks"
import type { Bill } from "@/lib/policy/types"
import { amendmentText, diffDocs, instructions, marked, type Amendment, type Citation, type Convention, type MarkedSpec, type Run } from "@/lib/typeset/amend"
import { billWork } from "@/lib/xml/address"
import { workHref } from "@/lib/xml/library"
import { AtPalette, AtTrigger } from "@/components/workspace/typeset-at-palette"
import { CiteDecorations, useCitations } from "@/components/workspace/typeset-cite-layer"
import { TypesetFrame } from "@/components/workspace/typeset-frame"
import { XML_EXTENSIONS } from "@/components/workspace/typeset-xml-extensions"
import { TypesetXmlToolbar } from "@/components/workspace/typeset-xml-toolbar"
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
// and writes the amendment beside it in the jurisdiction's convention. Edit
// is the clean text; Redline is the base with the strikes and insertions
// laid over it as decorations. A commit stores the fork's document.

export type ForkPayload = {
  fork: Fork
  base: { address: string; date: string; label: string | null; fidelity: string; coverage: number | null; json: JSONContent }
  head: { id: number; json: JSONContent } | null
  commits: { id: number; message: string; description: string; author: string; created_at: string; parent_commit_id: number | null; doc_bytes: number | null }[]
  cite: Citation
}

const fmtDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })

const ForkHistory = Extension.create({
  name: "forkHistory",
  addProseMirrorPlugins: () => [history(), keymap({ "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo })],
})

const redlineKey = new PluginKey<DecorationSet>("redline")

/** The engine's specs as decorations over the base: strikes inline and on whole units, insertions as widgets. */
function decorate(doc: PmNode, specs: MarkedSpec[]): DecorationSet {
  const schema = doc.type.schema
  const serializer = DOMSerializer.fromSchema(schema)
  const out: Decoration[] = []
  for (const s of specs) {
    try {
      if (s.kind === "strike") out.push(Decoration.inline(s.from, s.to, { class: "amend-del" }))
      else if (s.kind === "strike-block") out.push(Decoration.node(s.from, s.to, { class: "amend-del-block" }))
      else if (s.kind === "insert")
        out.push(
          Decoration.widget(
            s.at,
            () => {
              const el = document.createElement("ins")
              el.className = "amend-ins"
              el.textContent = s.text
              return el
            },
            { side: 1, key: `i:${s.at}:${s.text}` }
          )
        )
      else
        out.push(
          Decoration.widget(
            s.at,
            () => {
              const el = document.createElement("div")
              el.className = "amend-ins-block"
              el.appendChild(serializer.serializeNode(schema.nodeFromJSON(s.node.toJSON())))
              return el
            },
            { side: -1, key: `b:${s.at}:${s.node.textContent}` }
          )
        )
    } catch {
      // A spec that no longer fits the base is left out rather than breaking the view.
    }
  }
  return DecorationSet.create(doc, out)
}

const Redline = Extension.create({
  name: "redline",
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key: redlineKey,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => {
          const specs = tr.getMeta(redlineKey) as MarkedSpec[] | undefined
          return specs ? decorate(tr.doc, specs) : set.map(tr.mapping, tr.doc)
        },
      },
      props: { decorations: (state) => redlineKey.getState(state) },
    }),
  ],
})

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

export function TypesetForkView({ forkId }: { forkId: number }) {
  const [data, setData] = React.useState<ForkPayload | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"edit" | "redline">("edit")
  const [amendment, setAmendment] = React.useState<Amendment | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [asking, setAsking] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [description, setDescription] = React.useState("")
  const specs = React.useRef<MarkedSpec[]>([])
  const router = useRouter()
  const routerRef = React.useRef(router)
  routerRef.current = router
  // Where "@" was typed, while the references palette is open (window 6).
  const [atPos, setAtPos] = React.useState<number | null>(null)

  const load = React.useCallback(() => {
    setFailed(null)
    return fetch(`/api/typeset/fork?id=${forkId}`)
      .then(async (r) => (r.ok ? (r.json() as Promise<ForkPayload>) : Promise.reject(new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? String(r.status)))))
      .then((body) => {
        setData(body)
        setMessage(`Amend ${body.fork.label ?? body.fork.work}`)
      })
      .catch((error: Error) => setFailed(error.message))
  }, [forkId])
  React.useEffect(() => {
    void load()
  }, [load])

  const editor = useEditor(
    {
      extensions: [...XML_EXTENSIONS, ForkHistory, CiteDecorations.configure({ onOpen: (href) => routerRef.current.push(href) }), AtTrigger.configure({ onAt: (pos) => setAtPos(pos) })],
      editable: true, immediatelyRender: false, content: data ? (data.head?.json ?? data.base.json) : null, enableInputRules: false, enablePasteRules: false },
    [data?.fork.id, data?.head?.id]
  )
  const redline = useEditor(
    {
      extensions: [...XML_EXTENSIONS, Redline],
      editable: false,
      immediatelyRender: false,
      content: data?.base.json ?? null,
      enableInputRules: false,
      enablePasteRules: false,
      onCreate: ({ editor: e }) => e.view.dispatch(e.state.tr.setMeta(redlineKey, specs.current)),
    },
    [data?.base.address, data?.fork.id]
  )

  // The fork's citations, found, resolved as of its base's date and decorated (window 6).
  useCitations(data ? editor : null, data ? { jurisdiction: data.cite.jurisdiction, work: data.cite.work, at: data.base.date.slice(0, 10), citing: data.base.address } : null)

  // The amendment, rewritten as the fork changes.
  React.useEffect(() => {
    if (!editor || !data) return
    const base = editor.schema.nodeFromJSON(data.base.json)
    const head = data.head ? editor.schema.nodeFromJSON(data.head.json) : base
    let timer = 0
    const run = () => {
      if (editor.isDestroyed) return
      const doc = editor.state.doc
      const diff = diffDocs(base, doc)
      setAmendment(instructions(diff, data.cite))
      setDirty(!doc.eq(head))
      specs.current = marked(diff)
      if (redline && !redline.isDestroyed) {
        try {
          redline.view.dispatch(redline.state.tr.setMeta(redlineKey, specs.current))
        } catch {
          // Not mounted yet: onCreate lays the specs down.
        }
      }
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
  }, [editor, redline, data])

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
      <TypesetXmlToolbar editor={mode === "edit" ? editor : null}>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["edit", "redline"] as const).map((m) => (
            <button key={m} type="button" data-active={mode === m} onClick={() => setMode(m)} className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
              {m === "edit" ? "Edit" : "Redline"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-xs" disabled={!editor || mode !== "edit"} aria-label="Insert a reference" onClick={() => editor && setAtPos(editor.state.selection.from)}>
          @
        </Button>
        <Button size="sm" disabled={!dirty || !data} className="h-7 bg-[#1f883d] text-xs text-white hover:bg-[#1a7f37]" onClick={() => setAsking(true)}>
          Commit…
        </Button>
      </TypesetXmlToolbar>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b px-4 text-xs text-muted-foreground">
        {data ? (
          <>
            <span className="truncate font-medium text-foreground">{data.fork.label ?? data.fork.work}</span>
            <span className="truncate">
              as of {fmtDay(data.base.date)}
              {data.fork.commits ? ` · ${data.fork.commits} commit${data.fork.commits === 1 ? "" : "s"}` : ""}
            </span>
            {failed && <span className="truncate text-destructive">{failed}</span>}
            <code className="ml-auto hidden truncate font-mono text-[11px] md:block">{data.fork.work}</code>
          </>
        ) : (
          <Skeleton className="h-3 w-48" />
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {!data && (
            <div className="flex flex-col gap-2 p-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          )}
          <div className={cn("uslm-doc amend-edit", mode !== "edit" && "hidden")}>
            <EditorContent editor={editor} />
          </div>
          <div className={cn("uslm-doc amend-redline", mode !== "redline" && "hidden")}>
            <EditorContent editor={redline} />
          </div>
        </div>
        <aside className="hidden w-[26rem] shrink-0 overflow-y-auto border-l lg:block">
          <Instructions amendment={data ? amendment : null} />
        </aside>
      </div>

      {atPos !== null && editor && data && <AtPalette editor={editor} pos={atPos} jurisdiction={data.cite.jurisdiction} state={data.fork.state} onClose={() => setAtPos(null)} />}

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
      <TypesetForkView forkId={forkId} />
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
