'use client';

import { TrailingBlockPlugin, type Value } from 'platejs';
import { type TPlateEditor, useEditorRef } from 'platejs/react';

import { AIKit } from '@/components/plate/editor/plugins/ai-kit';
import { AlignKit } from '@/components/plate/editor/plugins/align-kit';
import { AutoformatKit } from '@/components/plate/editor/plugins/autoformat-kit';
import { BasicBlocksKit } from '@/components/plate/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/components/plate/editor/plugins/basic-marks-kit';
import { BlockMenuKit } from '@/components/plate/editor/plugins/block-menu-kit';
import { BlockPlaceholderKit } from '@/components/plate/editor/plugins/block-placeholder-kit';
import { CalloutKit } from '@/components/plate/editor/plugins/callout-kit';
import { CodeBlockKit } from '@/components/plate/editor/plugins/code-block-kit';
import { ColumnKit } from '@/components/plate/editor/plugins/column-kit';
import { CommentKit } from '@/components/plate/editor/plugins/comment-kit';
import { CopilotKit } from '@/components/plate/editor/plugins/copilot-kit';
import { CursorOverlayKit } from '@/components/plate/editor/plugins/cursor-overlay-kit';
import { DateKit } from '@/components/plate/editor/plugins/date-kit';
import { DiscussionKit } from '@/components/plate/editor/plugins/discussion-kit';
import { DndKit } from '@/components/plate/editor/plugins/dnd-kit';
import { DocxKit } from '@/components/plate/editor/plugins/docx-kit';
import { EmojiKit } from '@/components/plate/editor/plugins/emoji-kit';
import { ExitBreakKit } from '@/components/plate/editor/plugins/exit-break-kit';
import { FloatingToolbarKit } from '@/components/plate/editor/plugins/floating-toolbar-kit';
import { FontKit } from '@/components/plate/editor/plugins/font-kit';
import { LineHeightKit } from '@/components/plate/editor/plugins/line-height-kit';
import { LinkKit } from '@/components/plate/editor/plugins/link-kit';
import { ListKit } from '@/components/plate/editor/plugins/list-kit';
import { MarkdownKit } from '@/components/plate/editor/plugins/markdown-kit';
import { MathKit } from '@/components/plate/editor/plugins/math-kit';
import { MediaKit } from '@/components/plate/editor/plugins/media-kit';
import { MentionKit } from '@/components/plate/editor/plugins/mention-kit';
import { SlashKit } from '@/components/plate/editor/plugins/slash-kit';
import { SuggestionKit } from '@/components/plate/editor/plugins/suggestion-kit';
import { TableKit } from '@/components/plate/editor/plugins/table-kit';
import { TocKit } from '@/components/plate/editor/plugins/toc-kit';
import { ToggleKit } from '@/components/plate/editor/plugins/toggle-kit';

// Potion (Brendan, 2026-09-10). Plate Pro's Potion is a commercial template —
// its source is behind Plate Plus and cannot be copied in — so this is the
// Notion-shaped editor built from the plugins the playground already ships,
// which is where Potion's own difference lies: it is the same Plate with the
// page's chrome taken away.
//
// One plugin apart from EditorKit: no FixedToolbarKit. Nothing sits above the
// page. Formatting arrives when it is asked for — the floating toolbar on a
// selection, "/" for a block, the drag handle's menu on a block — which is the
// whole of the Notion posture. Everything else the playground can do, this can
// do; the shell adds the sticky outline Potion puts beside the page.
export const PotionKit = [
  ...CopilotKit,
  ...AIKit,

  // Elements
  ...BasicBlocksKit,
  ...CodeBlockKit,
  ...TableKit,
  ...ToggleKit,
  ...TocKit,
  ...MediaKit,
  ...CalloutKit,
  ...ColumnKit,
  ...MathKit,
  ...DateKit,
  ...LinkKit,
  ...MentionKit,

  // Marks
  ...BasicMarksKit,
  ...FontKit,

  // Block Style
  ...ListKit,
  ...AlignKit,
  ...LineHeightKit,

  // Collaboration
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Editing
  ...SlashKit,
  ...AutoformatKit,
  ...CursorOverlayKit,
  ...BlockMenuKit,
  ...DndKit,
  ...EmojiKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,

  // Parsers
  ...DocxKit,
  ...MarkdownKit,

  // UI — the floating toolbar, and no fixed one.
  ...BlockPlaceholderKit,
  ...FloatingToolbarKit,
];

export type PotionEditor = TPlateEditor<Value, (typeof PotionKit)[number]>;

export const usePotionEditor = () => useEditorRef<PotionEditor>();
