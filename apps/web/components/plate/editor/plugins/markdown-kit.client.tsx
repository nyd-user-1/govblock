'use client';

import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { toPlatePlugin } from 'platejs/react';
import { useEffect } from 'react';
import type { Plugin } from 'unified';

import { MarkdownKit, MARKDOWN_OPTIONS } from './markdown-kit';

// The remark plugins for tables, maths and emoji shortcodes load after the
// editor mounts rather than with the page (typeset-perf, 2026-09-13):
// remark-emoji alone carries node-emoji and emojilib. The Markdown plugin reads
// its remark plugins when it parses or serializes, so a paste or an export
// after they arrive uses all of them; one in the first moments after a page
// opens reads plain Markdown. Client only: the hook is what keeps this out of
// the shared kit (markdown-kit.tsx), which server code also imports.
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

/** The shared kit with the on-demand remark plugins: for the client editors. */
export const MarkdownKitClient = [
  ...MarkdownKit.slice(0, 2),
  toPlatePlugin(MarkdownPlugin.configure({ options: MARKDOWN_OPTIONS }), {
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
  }),
];
