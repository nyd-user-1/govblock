"use client"

import * as React from "react"
import { Plate, usePlateEditor } from "platejs/react"
import type { Editor } from "@tiptap/react"

import { BillKit } from "@/components/plate/editor/bill-kit"
import { FixedToolbar } from "@/components/plate/ui/fixed-toolbar"
import { FixedToolbarButtons } from "@/components/plate/ui/fixed-toolbar-buttons"
import { XmlToolbarGroups } from "@/components/workspace/typeset-xml-toolbar"
import { FileMenu } from "@/components/workspace/typeset-file-menu"

// The rich-text toolbar, on the views that have no rich-text editor under it
// (Brendan, 2026-09-12: "the rich text tool bar should never leave and it's in
// the main div, not the header"). Git, Diff, Versions and Fork draw their own
// text — a file, a redline, a code editor — so the toolbar stands where it
// always stands and takes no input, and the frame keeps one shape from view
// to view. It is Plate's own toolbar over an empty editor, not a drawing of
// one, so a button added to the editor's toolbar is added here too.
export function StaticToolbar({ xml, end }: { /** The XML views (Brendan, 2026-09-14): the USLM editor's own buttons lead the row, live when there is an editor. */ xml?: { editor: Editor | null }; /** A view's own controls, at the row's end. */ end?: React.ReactNode } = {}) {
  // BillKit, not the template's every-kit EditorKit (2026-09-13): this editor
  // exists only to draw the toolbar, and the full kit dragged the emoji data,
  // the code grammars and the rest onto Git, Redline and Diff. The buttons
  // for kits not in BillKit draw their stand-ins, which is all a disabled
  // toolbar needs.
  const editor = usePlateEditor({ plugins: BillKit, value: [{ type: "p", children: [{ text: "" }] }] })
  const formatting = (
    <div aria-disabled="true" className="pointer-events-none flex flex-1 opacity-50 select-none" title="Formatting applies in Typeset">
      <FixedToolbarButtons history={!xml} />
    </div>
  )
  // File leads every toolbar (Brendan, 2026-09-15), live even where the formatting is not.
  const fileMenu = (
    <div className="flex shrink-0 items-center">
      <FileMenu />
      <div className="mx-1.5 h-4 w-px bg-border" />
    </div>
  )
  return (
    <div className="shrink-0">
      <Plate editor={editor}>
        <FixedToolbar className="rounded-none">
          {fileMenu}
          {xml && (
            <div className="flex shrink-0 items-center">
              <XmlToolbarGroups editor={xml.editor} />
              <div className="mx-1.5 h-4 w-px bg-border" />
            </div>
          )}
          {formatting}
          {end && <div className="flex shrink-0 items-center gap-1 pl-2">{end}</div>}
        </FixedToolbar>
      </Plate>
    </div>
  )
}
