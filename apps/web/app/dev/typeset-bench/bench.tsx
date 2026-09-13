"use client"

import * as React from "react"

import { Plate, usePlateEditor } from "platejs/react"

import { billValue, EditorKit } from "@/components/plate/editor/editor-kit"
import { Editor, EditorContainer, renderProgressiveChunk } from "@/components/plate/ui/editor"
import { FixedToolbar } from "@/components/plate/ui/fixed-toolbar"
import { FixedToolbarButtons } from "@/components/plate/ui/fixed-toolbar-buttons"
import { TooltipProvider } from "@/components/plate/ui/tooltip"

declare global {
  interface Window {
    __bench?: { keys: string[]; plugins: number; drop: string[] }
  }
}

type Options = { drop: string[]; toolbar: boolean; chunk?: number; nav: boolean; cache: boolean; progressive: boolean }

function Document({ html, bill, drop, toolbar, chunk, nav, cache, progressive }: Options & { html: string; bill: string }) {
  const plugins = React.useMemo(() => EditorKit.filter((p) => p.key !== "fixed-toolbar" && !drop.includes(p.key)), [drop])
  performance.mark("bench:create-start")
  const editor = usePlateEditor({ plugins, value: cache ? billValue(`bench:${bill}:${drop.join(",")}`, html, plugins) : html, ...(chunk ? { chunking: { chunkSize: chunk } } : {}), ...(nav ? {} : { navigationFeedback: false }) })
  performance.mark("bench:create-end")
  React.useEffect(() => {
    performance.mark("bench:mounted")
    window.__bench = { keys: EditorKit.map((p) => p.key), plugins: plugins.length, drop }
  }, [plugins, drop])
  return (
    <Plate editor={editor}>
      <div className="flex h-full min-h-0 flex-col">
        {toolbar && (
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>
        )}
        <div className="flex min-h-0 flex-1">
          <EditorContainer>
            <Editor variant="demo" renderChunk={progressive ? renderProgressiveChunk : undefined} />
          </EditorContainer>
        </div>
      </div>
    </Plate>
  )
}

export function TypesetBench({ bill, ...options }: Options & { bill: string }) {
  const [html, setHtml] = React.useState<string | null>(null)
  React.useEffect(() => {
    fetch(`/api/typeset/content?${new URLSearchParams({ item: "article", bill })}`)
      .then((r) => r.json() as Promise<{ html?: string; error?: string }>)
      .then((r) => {
        performance.mark("bench:fetched")
        setHtml(r.html ?? `<p>${r.error ?? "Nothing to open."}</p>`)
      })
  }, [bill])
  return <div className="h-[calc(100dvh-4rem)] w-full">{html === null ? <p className="p-8">Loading…</p> : <TooltipProvider><Document html={html} bill={bill} {...options} /></TooltipProvider>}</div>
}
