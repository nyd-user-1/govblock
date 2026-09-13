'use client';

import { CodeBlockRules, setCodeBlockToDecorations } from '@platejs/code-block';
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from '@platejs/code-block/react';
import { KEYS, type TElement } from 'platejs';
import { useEditorSelector } from 'platejs/react';
import * as React from 'react';

import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from '@/components/plate/ui/code-block-node';

import { currentLowlight, loadLowlight } from './lowlight';

export const CodeBlockKit = [
  CodeBlockPlugin.configure(() => ({
    inputRules: [CodeBlockRules.markdown({ on: 'match' })],
    node: { component: CodeBlockElement },
    // The grammars load when the document has a code block (lowlight.ts);
    // until then code blocks show as plain text, then highlight.
    options: { lowlight: currentLowlight() },
    shortcuts: { toggle: { keys: 'mod+alt+8' } },
    useHooks: ({ editor, getOption, setOption }) => {
      const waiting = useEditorSelector(
        (editor) =>
          !getOption('lowlight') &&
          editor.children.some(
            (node) => node.type === editor.getType(KEYS.codeBlock)
          ),
        []
      );

      React.useEffect(() => {
        if (!waiting) return;

        let live = true;

        void loadLowlight().then((lowlight) => {
          if (!live) return;

          setOption('lowlight', lowlight);

          for (const entry of editor.api.nodes<TElement>({
            at: [],
            match: { type: editor.getType(KEYS.codeBlock) },
          })) {
            setCodeBlockToDecorations(editor, entry);
          }

          editor.api.redecorate();
        });

        return () => {
          live = false;
        };
      }, [editor, setOption, waiting]);
    },
  })),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
];
