import type { createLowlight } from 'lowlight';

// Highlight.js's grammars, loaded when a code block needs them rather than
// with every page that has an editor (typeset-perf, 2026-09-13): `lowlight`'s
// `all` is 1.5 MB of development JavaScript, on Typeset where a bill has no
// code blocks at all.

type Lowlight = ReturnType<typeof createLowlight>;

let instance: Lowlight | null = null;
let loading: Promise<Lowlight> | null = null;

export function loadLowlight() {
  loading ??= import('lowlight').then(({ all, createLowlight }) => {
    instance = createLowlight(all);

    return instance;
  });

  return loading;
}

/** The grammars if they have loaded, otherwise null. */
export function currentLowlight() {
  return instance;
}
