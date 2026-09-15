'use client';

import {
  ArrowUpToLineIcon,
  BaselineIcon,
  BoldIcon,
  Code2Icon,
  HighlighterIcon,
  ItalicIcon,
  PaintBucketIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { ImagePlusIcon, ListCollapseIcon, MinusIcon, PlusIcon, SmileIcon } from 'lucide-react';
import { cn } from '@govblock/ui/lib/utils';
import dynamic from 'next/dynamic';

import { ActionsToolbarButton } from './actions-toolbar-button';
import { AlignToolbarButton } from './align-toolbar-button';
import { CommentToolbarButton } from './comment-toolbar-button';
import { ExportToolbarButton } from './export-toolbar-button';
import { FontColorToolbarButton } from './font-color-toolbar-button';
import { RedoToolbarButton, UndoToolbarButton } from './history-toolbar-button';
import { ImportToolbarButton } from './import-toolbar-button';
import {
  IndentToolbarButton,
  OutdentToolbarButton,
} from './indent-toolbar-button';
import { InsertToolbarButton } from './insert-toolbar-button';
import { LazyKitButton } from './lazy-kit-button';
import { LineHeightToolbarButton } from './line-height-toolbar-button';
import { LinkToolbarButton } from './link-toolbar-button';
import {
  BulletedListToolbarButton,
  NumberedListToolbarButton,
  TodoListToolbarButton,
} from './list-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { ModeToolbarButton } from './mode-toolbar-button';
import { MoreToolbarButton } from './more-toolbar-button';
import { TableToolbarButton } from './table-toolbar-button';
import { ToolbarButton, ToolbarGroup } from './toolbar';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button';

// The buttons whose kits load on demand load their own code the same way
// (2026-09-13); until the kit is in the editor only their stand-in is drawn.
const AIToolbarButton = dynamic(() => import('./ai-toolbar-button').then((m) => m.AIToolbarButton), { ssr: false });
const EmojiToolbarButton = dynamic(() => import('./emoji-toolbar-button').then((m) => m.EmojiToolbarButton), { ssr: false });
const FontSizeToolbarButton = dynamic(() => import('./font-size-toolbar-button').then((m) => m.FontSizeToolbarButton), { ssr: false });
const MediaToolbarMenu = dynamic(() => import('./media-toolbar-button').then((m) => m.MediaToolbarMenu), { ssr: false });
const ToggleToolbarButton = dynamic(() => import('./toggle-toolbar-button').then((m) => m.ToggleToolbarButton), { ssr: false });

export function FixedToolbarButtons({ history = true }: { /** Off where another editor's undo and redo lead the row (the XML views, 2026-09-14). */ history?: boolean } = {}) {
  // Every button is drawn (Brendan, 2026-09-13). One whose kit the editor was
  // built without (BillKit leaves out AI, emoji, media, toggles and font
  // sizes) loads its kit when it is used; see lazy-kit-button.tsx.
  // Drawn in Viewing too (Brendan, 2026-09-14): the mode changes what a
  // button does, not whether the toolbar is there.

  return (
    <div className="flex w-full">
      {(
        <>
          {history && (
            <ToolbarGroup>
              <UndoToolbarButton />
              <RedoToolbarButton />
            </ToolbarGroup>
          )}

          <ToolbarGroup>
            <LazyKitButton kit="ai" pluginKey={KEYS.aiChat} tooltip="AI commands" icon={<WandSparklesIcon />}>
              <AIToolbarButton tooltip="AI commands">
                <WandSparklesIcon />
              </AIToolbarButton>
            </LazyKitButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <ExportToolbarButton>
              <ArrowUpToLineIcon />
            </ExportToolbarButton>

            <ImportToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <InsertToolbarButton />
            <TurnIntoToolbarButton />
            <LazyKitButton
              kit="fontSize"
              pluginKey={KEYS.fontSize}
              open={false}
              placeholder={({ onPointerEnter, onClick, pending }) => (
                <div className={cn('flex h-7 items-center gap-1 rounded-md bg-muted/60 p-0', pending && 'animate-pulse')} onPointerEnter={onPointerEnter}>
                  <ToolbarButton onClick={onClick}>
                    <MinusIcon />
                  </ToolbarButton>
                  <span className="h-full w-10 text-center text-sm leading-7">16</span>
                  <ToolbarButton onClick={onClick}>
                    <PlusIcon />
                  </ToolbarButton>
                </div>
              )}
            >
              <FontSizeToolbarButton />
            </LazyKitButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip="Underline (⌘+U)"
            >
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip="Strikethrough (⌘+⇧+M)"
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
              <Code2Icon />
            </MarkToolbarButton>

            <FontColorToolbarButton nodeType={KEYS.color} tooltip="Text color">
              <BaselineIcon />
            </FontColorToolbarButton>

            <FontColorToolbarButton
              nodeType={KEYS.backgroundColor}
              tooltip="Background color"
            >
              <PaintBucketIcon />
            </FontColorToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <AlignToolbarButton />

            <NumberedListToolbarButton />
            <BulletedListToolbarButton />
            <TodoListToolbarButton />
            <LazyKitButton kit="toggle" pluginKey={KEYS.toggle} tooltip="Toggle" icon={<ListCollapseIcon />}>
              <ToggleToolbarButton />
            </LazyKitButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <LinkToolbarButton />
            <TableToolbarButton />
            <LazyKitButton kit="emoji" pluginKey={KEYS.emoji} tooltip="Emoji" isDropdown icon={<SmileIcon />}>
              <EmojiToolbarButton />
            </LazyKitButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <LazyKitButton kit="media" pluginKey={KEYS.img} tooltip="Insert media" isDropdown icon={<ImagePlusIcon />}>
              <MediaToolbarMenu />
            </LazyKitButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <LineHeightToolbarButton />
            <OutdentToolbarButton />
            <IndentToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MoreToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <div className="grow" />

      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <HighlighterIcon />
        </MarkToolbarButton>
        <CommentToolbarButton />
        <ActionsToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <ModeToolbarButton />
      </ToolbarGroup>
    </div>
  );
}
