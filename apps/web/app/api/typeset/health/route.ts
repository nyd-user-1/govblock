import { NextResponse } from "next/server"

// Typeset's own health (2026-09-15): every module the reader stands on,
// loaded one at a time so the first one that fails names itself, then one
// stored Expression read. On the box each line says ok; on the deployed site
// this is how a bare "Internal Server Error" gets a sentence.
export const dynamic = "force-dynamic"

const brief = (error: unknown) => {
  const e = error as { name?: string; message?: string; stack?: string; code?: string }
  return { name: e?.name, code: e?.code, message: String(e?.message ?? error).slice(0, 400), stack: String(e?.stack ?? "").split("\n").slice(0, 6).join(" | ").slice(0, 900) }
}

export async function GET(request: Request) {
  const out: Record<string, unknown> = { node: process.version, cwd: process.cwd(), region: process.env.AWS_REGION ?? null }
  const steps: [string, () => Promise<unknown>][] = [
    ["linkedom", () => import("linkedom").then((m) => typeof m.parseHTML)],
    ["prosemirror-model", () => import("@tiptap/pm/model").then((m) => typeof m.Schema)],
    ["xml/schema", () => import("@/lib/xml/schema").then((m) => Object.keys(m.xmlSchema.nodes).length)],
    ["xml/convert", () => import("@/lib/xml/convert").then((m) => typeof m.docToHtml)],
    ["xml/ir", () => import("@/lib/xml/ir").then((m) => typeof m.parseXml)],
    ["xml/uslm-to-doc", () => import("@/lib/xml/uslm-to-doc").then((m) => typeof m.uslmToDoc)],
    ["policy/expressions", () => import("@/lib/policy/expressions").then((m) => typeof m.readUslm)],
    ["typeset/expression-document", () => import("@/lib/typeset/expression-document").then((m) => typeof m.findExpression)],
    ["xml/library", () => import("@/lib/xml/library").then((m) => typeof m.workHref)],
    ["typeset/document", () => import("@/lib/typeset/document").then((m) => Object.keys(m).length)],
  ]
  for (const [name, run] of steps) {
    const t = Date.now()
    try {
      out[name] = { ok: await run(), ms: Date.now() - t }
    } catch (error) {
      out[name] = { error: brief(error), ms: Date.now() - t }
    }
  }
  if (new URL(request.url).searchParams.get("read") === "1") {
    const t = Date.now()
    try {
      const { findExpression } = await import("@/lib/typeset/expression-document")
      const found = await findExpression("/us/bill/119/hr/6644", null)
      out.read = { ok: found ? `${found.row.work}@${found.row.expression}` : null, ms: Date.now() - t }
    } catch (error) {
      out.read = { error: brief(error), ms: Date.now() - t }
    }
  }
  return NextResponse.json(out)
}
