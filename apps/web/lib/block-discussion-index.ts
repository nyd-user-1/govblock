'use client';

import { CommentPlugin } from '@platejs/comment/react';

import type { TResolvedSuggestion } from '@platejs/suggestion';
import { getSuggestionKey, keyId2SuggestionId } from '@platejs/suggestion';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import {
  ElementApi,
  KEYS,
  NodeApi,
  type NodeEntry,
  type Path,
  PathApi,
  type TCommentText,
  type TElement,
  TextApi,
  type TSuggestionText,
} from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { useEditorRef, useEditorVersion, usePluginOption } from 'platejs/react';
import * as React from 'react';

import {
  discussionPlugin,
  type TDiscussion,
} from '@/components/plate/editor/plugins/discussion-kit';

import type { TComment } from '@/components/plate/ui/comment';

export interface ResolvedSuggestion extends TResolvedSuggestion {
  comments: TComment[];
}

export const BLOCK_SUGGESTION_TOKEN = '__block__';

type BlockDiscussionEntry = NodeEntry<
  TCommentText | TElement | TSuggestionText
>;
type SuggestionEntry = NodeEntry<TElement | TSuggestionText>;

type BlockDiscussionIndex = {
  discussionsByBlock: Map<string, TDiscussion[]>;
  suggestionsByBlock: Map<string, ResolvedSuggestion[]>;
};

type BuildBlockDiscussionIndexOptions = {
  entries: BlockDiscussionEntry[];
  discussions: TDiscussion[];
  getCommentId: (node: TCommentText) => string | undefined;
  getSuggestionData: (node: TElement | TSuggestionText) =>
    | {
        createdAt: Date | number | string;
        id: string;
        isLineBreak?: boolean;
        newProperties?: Record<string, unknown>;
        properties?: Record<string, unknown>;
        type: 'insert' | 'remove' | 'update';
        userId: string;
      }
    | undefined;
  getSuggestionDataList: (node: TSuggestionText) => Array<{
    id: string;
    newProperties?: Record<string, unknown>;
    properties?: Record<string, unknown>;
    type: 'insert' | 'remove' | 'update';
  }>;
  getSuggestionId: (node: TElement | TSuggestionText) => string | undefined;
  isBlockSuggestion: (node: TElement | TSuggestionText) => boolean;
};

const TYPE_TEXT_MAP: Record<string, (node?: TElement) => string> = {
  [KEYS.audio]: () => 'Audio',
  [KEYS.blockquote]: () => 'Blockquote',
  [KEYS.callout]: () => 'Callout',
  [KEYS.codeBlock]: () => 'Code Block',
  [KEYS.column]: () => 'Column',
  [KEYS.equation]: () => 'Equation',
  [KEYS.file]: () => 'File',
  [KEYS.h1]: () => 'Heading 1',
  [KEYS.h2]: () => 'Heading 2',
  [KEYS.h3]: () => 'Heading 3',
  [KEYS.h4]: () => 'Heading 4',
  [KEYS.h5]: () => 'Heading 5',
  [KEYS.h6]: () => 'Heading 6',
  [KEYS.hr]: () => 'Horizontal Rule',
  [KEYS.img]: () => 'Image',
  [KEYS.mediaEmbed]: () => 'Media',
  [KEYS.p]: (node) => {
    if (node?.[KEYS.listType] === KEYS.listTodo) return 'Todo List';
    if (node?.[KEYS.listType] === KEYS.ol) return 'Ordered List';
    if (node?.[KEYS.listType] === KEYS.ul) return 'List';

    return 'Paragraph';
  },
  [KEYS.table]: () => 'Table',
  [KEYS.toc]: () => 'Table of Contents',
  [KEYS.toggle]: () => 'Toggle',
  [KEYS.video]: () => 'Video',
};

const appendByKey = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const values = map.get(key);

  if (values) {
    values.push(value);
    return;
  }

  map.set(key, [value]);
};

const getBlockKey = (path: Path) => path.join(',');

const getTopLevelPath = (path: Path): Path | null =>
  path.length > 0 ? path.slice(0, 1) : null;

const getSuggestionIds = (
  node: TCommentText | TElement | TSuggestionText,
  getSuggestionDataList: BuildBlockDiscussionIndexOptions['getSuggestionDataList'],
  getSuggestionId: BuildBlockDiscussionIndexOptions['getSuggestionId']
) => {
  if (TextApi.isText(node)) {
    const dataList = getSuggestionDataList(node as TSuggestionText);
    const updateIds = dataList
      .filter((data) => data.type === 'update')
      .map((data) => data.id);

    if (updateIds.length > 0) return updateIds;

    const suggestionId = getSuggestionId(node as TSuggestionText);

    return suggestionId ? [suggestionId] : [];
  }

  if (ElementApi.isElement(node)) {
    const suggestionId = getSuggestionId(node);

    return suggestionId ? [suggestionId] : [];
  }

  return [];
};

const suggestionTypeText = (node: TElement) =>
  (TYPE_TEXT_MAP[node.type] ?? (() => node.type))(node);

const formatSuggestionDateText = (date: string) => {
  const elementDate = new Date(date);

  if (Number.isNaN(elementDate.getTime())) return date;

  const today = new Date();
  const yesterday = new Date(today);
  const tomorrow = new Date(today);

  yesterday.setDate(today.getDate() - 1);
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (left: Date, right: Date) =>
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear();

  if (sameDay(elementDate, today)) return 'Today';
  if (sameDay(elementDate, yesterday)) return 'Yesterday';
  if (sameDay(elementDate, tomorrow)) return 'Tomorrow';

  return elementDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const getInlineSuggestionElementText = (node: TElement) => {
  if (typeof node.value === 'string' && node.value.length > 0) {
    return node.value;
  }

  if (typeof node.date === 'string' && node.date.length > 0) {
    return formatSuggestionDateText(node.date);
  }

  if (
    node.type === KEYS.inlineEquation &&
    typeof (node as TElement & { texExpression?: unknown }).texExpression ===
      'string' &&
    (node as TElement & { texExpression: string }).texExpression.length > 0
  ) {
    return (node as TElement & { texExpression: string }).texExpression;
  }

  const nodeText = NodeApi.string(node);

  if (nodeText.length > 0) {
    return nodeText;
  }
};

const toResolvedSuggestion = ({
  discussionsById,
  entries,
  getSuggestionData,
  getSuggestionDataList,
  id,
  isBlockSuggestion,
}: {
  discussionsById: Map<string, TDiscussion>;
  entries: SuggestionEntry[];
  getSuggestionData: BuildBlockDiscussionIndexOptions['getSuggestionData'];
  getSuggestionDataList: BuildBlockDiscussionIndexOptions['getSuggestionDataList'];
  id: string;
  isBlockSuggestion: BuildBlockDiscussionIndexOptions['isBlockSuggestion'];
}): ResolvedSuggestion | null => {
  const sortedEntries = [...entries].sort(([, path1], [, path2]) =>
    PathApi.isChild(path1, path2) ? -1 : 1
  );

  if (sortedEntries.length === 0) return null;

  let newText = '';
  let text = '';
  let properties: Record<string, unknown> = {};
  let newProperties: Record<string, unknown> = {};

  sortedEntries.forEach(([node]) => {
    if (TextApi.isText(node)) {
      getSuggestionDataList(node as TSuggestionText).forEach((data) => {
        if (data.id !== id) return;

        switch (data.type) {
          case 'insert': {
            newText += node.text;
            break;
          }
          case 'remove': {
            text += node.text;
            break;
          }
          case 'update': {
            properties = { ...properties, ...data.properties };
            newProperties = { ...newProperties, ...data.newProperties };
            newText += node.text;
            break;
          }
        }
      });

      return;
    }

    if (!ElementApi.isElement(node)) return;

    const suggestionData = getSuggestionData(node);

    if (suggestionData?.id !== keyId2SuggestionId(id)) return;

    const inlineSuggestionText = getInlineSuggestionElementText(node);

    if (inlineSuggestionText) {
      if (suggestionData.type === 'insert') {
        newText += inlineSuggestionText;
      } else if (suggestionData.type === 'remove') {
        text += inlineSuggestionText;
      } else if (suggestionData.type === 'update') {
        properties = { ...properties, ...suggestionData.properties };
        newProperties = {
          ...newProperties,
          ...suggestionData.newProperties,
        };
        newText += inlineSuggestionText;
      }

      return;
    }

    if (!isBlockSuggestion(node)) return;

    const nextText = suggestionData.isLineBreak
      ? BLOCK_SUGGESTION_TOKEN
      : `${BLOCK_SUGGESTION_TOKEN}${suggestionTypeText(node)}`;

    if (suggestionData.type === 'insert') {
      newText += nextText;
    } else if (suggestionData.type === 'remove') {
      text += nextText;
    }
  });

  const suggestionData = getSuggestionData(sortedEntries[0][0]);

  if (!suggestionData) return null;

  const keyId = getSuggestionKey(id);
  const comments = discussionsById.get(id)?.comments ?? [];
  const createdAt = new Date(suggestionData.createdAt);
  const suggestionId = keyId2SuggestionId(id);

  if (suggestionData.type === 'update') {
    return {
      comments,
      createdAt,
      keyId,
      newProperties,
      newText,
      properties,
      suggestionId,
      type: 'update',
      userId: suggestionData.userId,
    };
  }

  if (newText.length > 0 && text.length > 0) {
    return {
      comments,
      createdAt,
      keyId,
      newText,
      suggestionId,
      text,
      type: 'replace',
      userId: suggestionData.userId,
    };
  }

  if (newText.length > 0) {
    return {
      comments,
      createdAt,
      keyId,
      newText,
      suggestionId,
      type: 'insert',
      userId: suggestionData.userId,
    };
  }

  if (text.length > 0) {
    return {
      comments,
      createdAt,
      keyId,
      suggestionId,
      text,
      type: 'remove',
      userId: suggestionData.userId,
    };
  }

  return null;
};

export const buildBlockDiscussionIndex = ({
  discussions,
  entries,
  getCommentId,
  getSuggestionData,
  getSuggestionDataList,
  getSuggestionId,
  isBlockSuggestion,
}: BuildBlockDiscussionIndexOptions): BlockDiscussionIndex => {
  const commentOwnerById = new Map<string, Path>();
  const suggestionOwnerById = new Map<string, Path>();
  const commentIds = new Set<string>();
  const suggestionEntriesById = new Map<string, SuggestionEntry[]>();
  const discussionsById = new Map(
    discussions.map((discussion) => [discussion.id, discussion])
  );

  entries.forEach(([node, path]) => {
    const blockPath = getTopLevelPath(path);

    if (!blockPath) return;

    if (TextApi.isText(node)) {
      const commentId = getCommentId(node);

      if (commentId) {
        commentIds.add(commentId);

        if (!commentOwnerById.has(commentId)) {
          commentOwnerById.set(commentId, blockPath);
        }
      }
    }

    getSuggestionIds(node, getSuggestionDataList, getSuggestionId).forEach(
      (suggestionId) => {
        if (!suggestionOwnerById.has(suggestionId)) {
          suggestionOwnerById.set(suggestionId, blockPath);
        }

        appendByKey(suggestionEntriesById, suggestionId, [
          node as TElement | TSuggestionText,
          path,
        ]);
      }
    );
  });

  const discussionsByBlock = new Map<string, TDiscussion[]>();

  discussions.forEach((discussion) => {
    const ownerPath = commentOwnerById.get(discussion.id);

    if (!ownerPath || !commentIds.has(discussion.id) || discussion.isResolved) {
      return;
    }

    appendByKey(discussionsByBlock, getBlockKey(ownerPath), {
      ...discussion,
      createdAt: new Date(discussion.createdAt),
    });
  });

  const suggestionsByBlock = new Map<string, ResolvedSuggestion[]>();

  suggestionEntriesById.forEach((suggestionEntries, suggestionId) => {
    const ownerPath = suggestionOwnerById.get(suggestionId);

    if (!ownerPath) return;

    const resolvedSuggestion = toResolvedSuggestion({
      discussionsById,
      entries: suggestionEntries,
      getSuggestionData,
      getSuggestionDataList,
      id: suggestionId,
      isBlockSuggestion,
    });

    if (!resolvedSuggestion) return;

    appendByKey(suggestionsByBlock, getBlockKey(ownerPath), resolvedSuggestion);
  });

  return {
    discussionsByBlock,
    suggestionsByBlock,
  };
};

// Each block's discussions and suggestions, published from one store per
// editor (typeset-perf, 2026-09-13). The template had every top-level block
// call useEditorVersion and rebuild this index itself, so a keystroke in a
// 3,023-block bill re-rendered all 3,023 blocks: half a second a key. Now the
// index is rebuilt once, after typing pauses, and a block re-renders only
// when its own items change. Blocks are keyed by id, which survives blocks
// being inserted above them; a path would not.

export type BlockDiscussionItems = {
  resolvedDiscussions: TDiscussion[];
  resolvedSuggestions: ResolvedSuggestion[];
};

const EMPTY_ITEMS: BlockDiscussionItems = {
  resolvedDiscussions: [],
  resolvedSuggestions: [],
};

const REBUILD_AFTER_MS = 120;

type DiscussionStore = {
  byBlock: Map<string, BlockDiscussionItems>;
  signatures: Map<string, string>;
  listeners: Set<() => void>;
  subscribe: (listener: () => void) => () => void;
  timer: ReturnType<typeof setTimeout> | null;
};

const discussionStores = new WeakMap<PlateEditor, DiscussionStore>();

const getDiscussionStore = (editor: PlateEditor) => {
  let store = discussionStores.get(editor);

  if (!store) {
    const listeners = new Set<() => void>();
    store = {
      byBlock: new Map(),
      signatures: new Map(),
      listeners,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      timer: null,
    };
    discussionStores.set(editor, store);
  }

  return store;
};

export const blockDiscussionKey = (editor: PlateEditor, element: TElement) =>
  typeof element.id === 'string'
    ? element.id
    : getBlockKey(editor.api.findPath(element) ?? []);

// Blocks are immutable: one scanned for comment and suggestion props stays
// scanned until an edit replaces it, so a rebuild walks only changed blocks
// and the few that carry marks.
const blockMarks = new WeakMap<object, boolean>();

const hasMarks = (node: object): boolean => {
  const cached = blockMarks.get(node);

  if (cached !== undefined) return cached;

  let found = false;

  for (const key in node) {
    if (key.startsWith('comment') || key.startsWith('suggestion')) {
      found = true;
      break;
    }
  }

  if (!found && ElementApi.isElement(node)) {
    found = node.children.some(hasMarks);
  }

  blockMarks.set(node, found);

  return found;
};

const rebuildDiscussionStore = (
  editor: PlateEditor,
  discussions: TDiscussion[]
) => {
  const store = getDiscussionStore(editor);
  const entries: BlockDiscussionEntry[] = [];

  editor.children.forEach((block, index) => {
    if (!hasMarks(block)) return;

    for (const entry of editor.api.nodes({ at: [index], mode: 'all' })) {
      entries.push(entry as BlockDiscussionEntry);
    }
  });

  let index: BlockDiscussionIndex = {
    discussionsByBlock: new Map(),
    suggestionsByBlock: new Map(),
  };

  if (entries.length > 0) {
    const commentApi = editor.getApi(CommentPlugin).comment;
    const suggestionApi = editor.getApi(SuggestionPlugin).suggestion;

    index = buildBlockDiscussionIndex({
      discussions,
      entries,
      getCommentId: (node) => commentApi.nodeId(node),
      getSuggestionData: (node) => suggestionApi.suggestionData(node),
      getSuggestionDataList: (node) => suggestionApi.dataList(node),
      getSuggestionId: (node) => suggestionApi.nodeId(node),
      isBlockSuggestion: (node) =>
        ElementApi.isElement(node) && suggestionApi.isBlockSuggestion(node),
    });
  }

  const byBlock = new Map<string, BlockDiscussionItems>();
  const signatures = new Map<string, string>();
  const pathKeys = new Set([
    ...index.discussionsByBlock.keys(),
    ...index.suggestionsByBlock.keys(),
  ]);

  pathKeys.forEach((pathKey) => {
    const block = editor.children[Number(pathKey)];

    if (!block) return;

    const key = blockDiscussionKey(editor, block as TElement);
    const items = {
      resolvedDiscussions: index.discussionsByBlock.get(pathKey) ?? [],
      resolvedSuggestions: index.suggestionsByBlock.get(pathKey) ?? [],
    };
    const signature = JSON.stringify(items);
    const previous = store.byBlock.get(key);

    // Unchanged items keep their identity, so their block does not re-render.
    byBlock.set(
      key,
      previous && store.signatures.get(key) === signature ? previous : items
    );
    signatures.set(key, signature);
  });

  const changed =
    byBlock.size !== store.byBlock.size ||
    [...byBlock].some(([key, items]) => store.byBlock.get(key) !== items);

  store.byBlock = byBlock;
  store.signatures = signatures;

  if (changed) store.listeners.forEach((listener) => listener());
};

/** Keeps the editor's discussion store current; mounted once, by the discussion plugin. */
export const useBlockDiscussionStore = () => {
  const editor = useEditorRef();
  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const version = useEditorVersion();

  React.useEffect(() => {
    const store = getDiscussionStore(editor);

    if (store.timer) clearTimeout(store.timer);

    store.timer = setTimeout(() => {
      store.timer = null;
      rebuildDiscussionStore(editor, discussions);
    }, REBUILD_AFTER_MS);
  }, [discussions, editor, version]);

  React.useEffect(
    () => () => {
      const store = getDiscussionStore(editor);

      if (store.timer) clearTimeout(store.timer);
    },
    [editor]
  );
};

export const useBlockDiscussionItems = (
  editor: PlateEditor,
  blockKey: string
): BlockDiscussionItems => {
  const store = getDiscussionStore(editor);

  return React.useSyncExternalStore(
    store.subscribe,
    () => store.byBlock.get(blockKey) ?? EMPTY_ITEMS,
    () => EMPTY_ITEMS
  );
};
