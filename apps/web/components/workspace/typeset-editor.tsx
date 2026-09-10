"use client"

import * as React from "react"

import { Plate, usePlateEditor } from "platejs/react"
import { Toaster } from "sonner"

import { EditorKit } from "@/components/plate/editor/editor-kit"
import { PotionKit } from "@/components/plate/editor/potion-kit"
import { PlateEditor } from "@/components/plate/editor/plate-editor"
import { Editor, EditorContainer } from "@/components/plate/ui/editor"
import { BillSkeleton } from "@/components/workspace/bill-skeleton"
import { PotionOutline } from "@/components/workspace/potion-outline"

// The Typeset editor (Brendan, 2026-09-09): Plate's playground editor, as the
// template ships it — its fixed toolbar under the shell's header, the centred
// column, every kit — opened on one of the bill's pages. With no bill in the
// URL it is the template's own placeholder document, untouched, so the two
// can be held side by side (Brendan: "a 1:1 comparison"). A page arrives as
// HTML from /api/typeset/content and Plate reads it in; a new page or bill
// rebuilds the editor rather than patching a document under a reader's hands.
//
// Since 2026-09-10 the same bill has two editors. Plate is the playground.
// Potion is the Notion posture: nothing above the page, formatting summoned by
// a selection or a "/", and Potion's sticky outline down the left edge.

export type TypesetSurface = "plate" | "potion"

type Loaded = { key: string; html: string }

function useContent(item: string, bill: string, version?: string) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const key = `${item}:${bill}:${version ?? ""}`
  React.useEffect(() => {
    if (!bill) return
    let live = true
    const sp = new URLSearchParams({ item, bill })
    if (version) sp.set("version", version)
    fetch(`/api/typeset/content?${sp}`)
      .then((r) => r.json() as Promise<{ html?: string; error?: string }>)
      .then(
        (r) =>
          live &&
          setLoaded({
            key,
            html: r.html ?? `<p>${r.error ?? "Nothing to open."}</p>`,
          })
      )
      .catch(
        () =>
          live &&
          setLoaded({ key, html: "<p>The bill could not be opened.</p>" })
      )
    return () => {
      live = false
    }
  }, [key, item, bill, version])
  return loaded && loaded.key === key ? loaded.html : null
}

/** A bill's page in the same editor the template draws, so nothing but the words differ. */
function Document({ html }: { html: string }) {
  const editor = usePlateEditor({ plugins: EditorKit, value: html })
  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Editor variant="demo" />
      </EditorContainer>
    </Plate>
  )
}

/** The same bill with the chrome taken away, and its shape beside it. */
function PotionDocument({ html }: { html: string }) {
  const editor = usePlateEditor({ plugins: PotionKit, value: html })
  return (
    <Plate editor={editor}>
      <EditorContainer className="relative">
        <PotionOutline />
        <Editor variant="default" />
      </EditorContainer>
    </Plate>
  )
}

export function TypesetEditor({
  item,
  bill,
  version,
  surface = "plate",
}: {
  item: string
  bill: string
  version?: string
  surface?: TypesetSurface
}) {
  const html = useContent(item, bill, version)
  const Body = surface === "potion" ? PotionDocument : Document
  return (
    <div data-slot="typeset-editor" className="h-full w-full">
      {!bill ? (
        <PlateEditor />
      ) : html === null ? (
        <BillSkeleton />
      ) : (
        <Body key={`${surface}:${item}:${bill}:${version ?? ""}`} html={html} />
      )}
      <Toaster />
    </div>
  )
}
