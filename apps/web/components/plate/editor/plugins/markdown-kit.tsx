import {
  BaseFootnoteDefinitionPlugin,
  BaseFootnoteReferencePlugin,
} from '@platejs/footnote';
import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { KEYS } from 'platejs';
import { toPlatePlugin } from 'platejs/react';
import { useEffect } from 'react';
import type { Plugin } from 'unified';

// The remark plugins for tables, maths and emoji shortcodes load after the
// editor mounts rather than with the page (typeset-perf, 2026-09-13):
// remark-emoji alone carries node-emoji and emojilib. The Markdown plugin reads
// its remark plugins when it parses or serializes, so a paste or an export
// after they arrive uses all of them; one in the first moments after a page
// opens reads plain Markdown.
let remarkPlugins: Promise<Plugin[]> | null = null;

const loadRemarkPlugins = () => {
  const loading =
    remarkPlugins ??
    Promise.all([
      import('remark-math'),
      import('remark-gfm'),
      import('remark-emoji'),
    ]).then(
      ([math, gfm, emoji]) =>
        [math.default, gfm.default, emoji.default, remarkMdx, remarkMention] as Plugin[]
    );

  remarkPlugins = loading;

  return loading;
};

export const MarkdownKit = [
  BaseFootnoteReferencePlugin,
  BaseFootnoteDefinitionPlugin,
  toPlatePlugin(
    MarkdownPlugin.configure({
      options: {
        plainMarks: [KEYS.suggestion, KEYS.comment],
        remarkPlugins: [remarkMdx, remarkMention],
      },
    }),
    {
      useHooks: ({ setOption }) => {
        useEffect(() => {
          let live = true;

          void loadRemarkPlugins().then(
            (plugins) => live && setOption('remarkPlugins', plugins)
          );

          return () => {
            live = false;
          };
        }, [setOption]);
      },
    }
  ),
];
