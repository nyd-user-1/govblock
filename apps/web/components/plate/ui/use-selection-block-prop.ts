'use client';

import {
  getContainerTypes,
  type EditorPropOptions,
  RangeApi,
  type TElement,
} from 'platejs';
import { useEditorSelector } from 'platejs/react';

// Plate's useSelectionFragmentProp copies the selection's fragment on every
// change to the editor, typing included: 2–3 ms a keystroke for each toolbar
// button that shows it, on a 3,023-block bill (typeset-perf, 2026-09-13). A
// caret sits in one block, so with the selection collapsed this reads that
// block's prop and copies nothing; an expanded selection still reads its
// fragment, as Plate does.
export function useSelectionBlockProp(
  options: Omit<EditorPropOptions, 'nodes'>
) {
  return useEditorSelector((editor) => {
    const { selection } = editor;

    if (selection && RangeApi.isCollapsed(selection)) {
      const entry = editor.api.block();

      return editor.api.prop({ ...options, nodes: entry ? [entry[0]] : [] });
    }

    const fragment = editor.api.fragment(selection, {
      unwrap: getContainerTypes(editor),
    });

    return editor.api.prop({ ...options, nodes: fragment as TElement[] });
  }, []);
}
