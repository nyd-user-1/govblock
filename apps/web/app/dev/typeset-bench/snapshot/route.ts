import { NextResponse } from "next/server"
import { getHeapStatistics } from "node:v8"
import { gzipSync } from "node:zlib"
import { createStaticEditor, serializeHtml } from "platejs/static"

import { EditorStatic } from "@/components/plate/ui/editor-static"
import { billStaticKit, getTypesetDocument } from "@/lib/typeset/document"

// Dev-only probe (typeset-perf, 2026-09-13): what it costs the server to render
// a bill's static snapshot to a string with the editor's static components,
// before a page is asked to carry one. The page's first attempt passed the
// static element tree through props and ran the dev server out of heap twice.
//
//   GET /dev/typeset-bench/snapshot?bill=<id>[&version=<doc>][&strip=1]

export const dynamic = "force-dynamic"

const mb = (bytes: number) => Math.round(bytes / 1048576)

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 })
  const sp = new URL(request.url).searchParams
  const billId = Number(sp.get("bill") ?? 2058568)
  const version = Number(sp.get("version") ?? 0) || undefined

  // Refuse rather than risk the shared server: the probe needs a few hundred MB.
  const before = getHeapStatistics()
  if (sp.get("heap") === "1") return NextResponse.json({ usedMB: mb(before.used_heap_size), totalMB: mb(before.total_heap_size), limitMB: mb(before.heap_size_limit) })
  if (before.used_heap_size > 0.6 * before.heap_size_limit)
    return NextResponse.json({ refused: "heap already above 60% of its limit", usedMB: mb(before.used_heap_size), limitMB: mb(before.heap_size_limit) }, { status: 503 })

  const t0 = performance.now()
  const document = await getTypesetDocument(billId, version)
  if (!document) return NextResponse.json({ error: "no such bill" }, { status: 404 })
  const t1 = performance.now()

  // Sampled while the render runs: serializeHtml awaits between its steps, so
  // the interval gets a turn now and then, and the last reading is taken after.
  let peak = getHeapStatistics().used_heap_size
  const sampler = setInterval(() => {
    peak = Math.max(peak, getHeapStatistics().used_heap_size)
  }, 5)
  const editor = createStaticEditor({ plugins: billStaticKit, value: document.value })
  const strip = sp.get("strip") === "1"
  const html = await serializeHtml(editor, { editorComponent: EditorStatic, props: { variant: "default" }, stripDataAttributes: strip })
  peak = Math.max(peak, getHeapStatistics().used_heap_size)
  clearInterval(sampler)
  const t2 = performance.now()

  return NextResponse.json({
    bill: billId,
    stripDataAttributes: strip,
    blocks: document.value.length,
    documentMs: Math.round(t1 - t0),
    serializeMs: Math.round(t2 - t1),
    heapBeforeMB: mb(before.used_heap_size),
    heapPeakMB: mb(peak),
    heapLimitMB: mb(before.heap_size_limit),
    snapshotKB: Math.round(Buffer.byteLength(html) / 1024),
    snapshotGzipKB: Math.round(gzipSync(html).length / 1024),
    articleHtmlKB: Math.round(Buffer.byteLength(document.html) / 1024),
    cachedSnapshotKB: Math.round(Buffer.byteLength(document.snapshot) / 1024),
    head: html.slice(0, 400),
  })
}
