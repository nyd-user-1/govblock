'use client';

import {
  BoldIcon,
  Code2Icon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { RadicalIcon } from 'lucide-react';
import { LazyKitButton } from './lazy-kit-button';
import dynamic from 'next/dynamic';
import { useEditorReadOnly } from 'platejs/react';

import { CommentToolbarButton } from './comment-toolbar-button';
import { LinkToolbarButton } from './link-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { MoreToolbarButton } from './more-toolbar-button';
import { SuggestionToolbarButton } from './suggestion-toolbar-button';
import { ToolbarGroup } from './toolbar';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button';

// On-demand kits' buttons load their own code on demand too (2026-09-13).
const AIToolbarButton = dynamic(() => import('./ai-toolbar-button').then((m) => m.AIToolbarButton), { ssr: false });
const InlineEquationToolbarButton = dynamic(() => import('./equation-toolbar-button').then((m) => m.InlineEquationToolbarButton), { ssr: false });

export function FloatingToolbarButtons() {
  const readOnly = useEditorReadOnly();

  return (
    <>
      {!readOnly && (
        <>
          <ToolbarGroup>
            <LazyKitButton kit="ai" pluginKey={KEYS.aiChat} tooltip="AI commands" icon={<><WandSparklesIcon />Ask AI</>}>
              <AIToolbarButton tooltip="AI commands">
                <WandSparklesIcon />
                Ask AI
              </AIToolbarButton>
            </LazyKitButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <TurnIntoToolbarButton />

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

            <LazyKitButton kit="math" pluginKey={KEYS.inlineEquation} tooltip="Equation" icon={<RadicalIcon />}>
              <InlineEquationToolbarButton />
            </LazyKitButton>

            <LinkToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <ToolbarGroup>
        <CommentToolbarButton />
        <SuggestionToolbarButton />

        {!readOnly && <MoreToolbarButton />}
      </ToolbarGroup>
    </>
  );
}
