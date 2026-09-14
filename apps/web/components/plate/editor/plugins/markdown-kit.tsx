import {
  BaseFootnoteDefinitionPlugin,
  BaseFootnoteReferencePlugin,
} from '@platejs/footnote';
import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { KEYS } from 'platejs';
import type { Plugin } from 'unified';

// The kit every editor shares, server-safe: no React hook here, because
// editor-base-kit carries it into app/api/ai/command (a server route) and the
// docs' static renders, and Turbopack refuses a client hook in a server
// module (Amplify job 272, 2026-09-13). The on-demand remark plugins — tables,
// maths, emoji, which load after the editor mounts — live in
// markdown-kit.client.tsx, which the client kits take instead.
export const MARKDOWN_OPTIONS = {
  plainMarks: [KEYS.suggestion, KEYS.comment],
  remarkPlugins: [remarkMdx, remarkMention] as Plugin[],
};

export const MarkdownKit = [
  BaseFootnoteReferencePlugin,
  BaseFootnoteDefinitionPlugin,
  MarkdownPlugin.configure({ options: MARKDOWN_OPTIONS }),
];
