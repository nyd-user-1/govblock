"use client"

import * as React from "react"
import { Plate, usePlateEditor } from "platejs/react"

import { EditorKit } from "@/components/plate/editor/editor-kit"
import { FixedToolbar } from "@/components/plate/ui/fixed-toolbar"
import { FixedToolbarButtons } from "@/components/plate/ui/fixed-toolbar-buttons"

// The rich-text toolbar, on the views that have no rich-text editor under it
// (Brendan, 2026-09-12: "the rich text tool bar should never leave and it's in
// the main div, not the header"). Git, Diff, Versions and Fork draw their own
// text — a file, a redline, a code editor — so the toolbar stands where it
// always stands and takes no input, and the frame keeps one shape from view
// to view. It is Plate's own toolbar over an empty editor, not a drawing of
// one, so a button added to the editor's toolbar is added here too.
export function StaticToolbar() {
  const editor = usePlateEditor({ plugins: EditorKit, value: [{ type: "p", children: [{ text: "" }] }] })
  return (
    <div aria-disabled="true" className="pointer-events-none shrink-0 opacity-50 select-none" title="Formatting applies in Typeset">
      <Plate editor={editor}>
        <FixedToolbar>
          <FixedToolbarButtons />
        </FixedToolbar>
      </Plate>
    </div>
  )
}
