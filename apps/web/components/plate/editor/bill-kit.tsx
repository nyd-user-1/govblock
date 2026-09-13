'use client';

import { TrailingBlockPlugin, type Value } from 'platejs';
import { createPlateEditor } from 'platejs/react';

import { AlignKit } from '@/components/plate/editor/plugins/align-kit';
import { BasicBlocksKit } from '@/components/plate/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/components/plate/editor/plugins/basic-marks-kit';
import { CommentKit } from '@/components/plate/editor/plugins/comment-kit';
import { CursorOverlayKit } from '@/components/plate/editor/plugins/cursor-overlay-kit';
import { DiscussionKit } from '@/components/plate/editor/plugins/discussion-kit';
import { DocxKit } from '@/components/plate/editor/plugins/docx-kit';
import { ExitBreakKit } from '@/components/plate/editor/plugins/exit-break-kit';
import { FloatingToolbarKit } from '@/components/plate/editor/plugins/floating-toolbar-kit';
import { FontKit } from '@/components/plate/editor/plugins/font-kit';
import { LineHeightKit } from '@/components/plate/editor/plugins/line-height-kit';
import { LinkKit } from '@/components/plate/editor/plugins/link-kit';
import { ListKit } from '@/components/plate/editor/plugins/list-kit';
import { MarkdownKit } from '@/components/plate/editor/plugins/markdown-kit';
import { SuggestionKit } from '@/components/plate/editor/plugins/suggestion-kit';
import { TableKit } from '@/components/plate/editor/plugins/table-kit';

// BillKit lives apart from editor-kit.tsx (typeset-perf, 2026-09-13): that
// module imports every kit for the template's EditorKit, and a page that
// imported BillKit from it loaded all of them, KaTeX, the AI SDK and emoji data
// included. editor-kit.tsx re-exports both names.

// What a bill needs, and nothing that runs on its every change without being
// needed (Brendan, 2026-09-13: headings, paragraphs, marks, lists, links,
// tables, comments and suggestions). Measured on /dev/typeset-bench against
// H.R. 6644 (docs/typeset-perf.md): the kits left out cost a bill 20 ms a
// keystroke, drag and drop alone 30,000 DOM nodes. Markdown and Docx stay for
// the toolbar's import and export; they do nothing while typing. Buttons for
// kits not here load them on use (lazy-kit-button.tsx).
export const BillKit = [
  // Elements
  ...BasicBlocksKit,
  ...TableKit,
  ...LinkKit,

  // Marks
  ...BasicMarksKit,
  ...FontKit.filter(
    (plugin) => plugin.key !== 'fontSize' && plugin.key !== 'fontFamily'
  ),

  // Block Style
  ...ListKit,
  ...AlignKit,
  ...LineHeightKit,

  // Collaboration
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Editing
  ...CursorOverlayKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,

  // Parsers
  ...DocxKit,
  ...MarkdownKit,

  // UI
  ...FloatingToolbarKit,
];

// A bill's HTML read into Slate once per page, not once per mount
// (typeset-perf, 2026-09-13). Opening Typeset parsed 355 KB of HTML every
// time, twice under development StrictMode: 0.3 s each on H.R. 6644. The
// parsed value is kept for the last few keys (bill, version) and handed to the
// next editor as its value; Slate never mutates nodes, so editors can share it.
type EditorPlugins = NonNullable<
  NonNullable<Parameters<typeof createPlateEditor>[0]>['plugins']
>;

const BILL_VALUES_KEPT = 4;
const billValues = new Map<string, Value>();

export function billValue(
  key: string,
  source: string | Value,
  plugins: EditorPlugins = BillKit
): Value {
  const cached = billValues.get(key);

  if (cached) {
    billValues.delete(key);
    billValues.set(key, cached);

    return cached;
  }

  // A value the server has already read (the content route's `value`) is kept
  // as it is; HTML is read here.
  const value =
    typeof source === 'string'
      ? createPlateEditor({ plugins, value: source }).children
      : source;

  billValues.set(key, value);

  if (billValues.size > BILL_VALUES_KEPT) {
    billValues.delete(billValues.keys().next().value!);
  }

  return value;
}
