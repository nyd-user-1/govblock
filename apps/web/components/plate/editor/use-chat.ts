'use client';

/* eslint-disable react-hooks/refs -- Fake stream abort control is imperative transport state. */

import { type UseChatHelpers, useChat as useBaseChat } from '@ai-sdk/react';
import { withAIBatch } from '@platejs/ai';
import {
  AIChatPlugin,
  aiCommentToRange,
  applyTableCellSuggestion,
} from '@platejs/ai/react';
import { getCommentKey, getTransientCommentKey } from '@platejs/comment';
import { deserializeMd } from '@platejs/markdown';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { KEYS, NodeApi, nanoid, TextApi, type TNode } from 'platejs';
import { type PlateEditor, useEditorRef, usePluginOption } from 'platejs/react';
import * as React from 'react';
import { aiChatPlugin } from '@/components/plate/editor/plugins/ai-kit';
import { discussionPlugin } from './plugins/discussion-kit';

export type ToolName = 'comment' | 'edit' | 'generate';

export type TComment = {
  comment: {
    blockId: string;
    comment: string;
    content: string;
  } | null;
  status: 'finished' | 'streaming';
};

export type TTableCellUpdate = {
  cellUpdate: {
    content: string;
    id: string;
  } | null;
  status: 'finished' | 'streaming';
};

export type MessageDataPart = {
  toolName: ToolName;
  comment?: TComment;
  table?: TTableCellUpdate;
};

export type Chat = UseChatHelpers<ChatMessage>;

export type ChatMessage = UIMessage<{}, MessageDataPart>;

function createChatTransport({
  api,
  abortControllerRef,
  editor,
}: {
  api: string;
  abortControllerRef: React.RefObject<AbortController | null>;
  editor: PlateEditor;
}) {
  return new DefaultChatTransport({
    api,
    // Mock the API response. Remove it when you implement the route /api/ai/command
    fetch: (async (input, init) => {
      const bodyOptions = editor.getOptions(aiChatPlugin).chatOptions?.body;

      const initBody = JSON.parse(init?.body as string);

      const body = {
        ...initBody,
        ...bodyOptions,
      };

      const res = await fetch(input, {
        ...init,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let sample: 'comment' | 'markdown' | 'mdx' | 'table' | null = null;

        try {
          const body = JSON.parse(init?.body as string);
          const content = body.messages
            .at(-1)
            .parts.find((p: any) => p.type === 'text')?.text;

          if (content.includes('Generate a markdown sample')) {
            sample = 'markdown';
          } else if (content.includes('Generate a mdx sample')) {
            sample = 'mdx';
          } else if (content.includes('comment')) {
            sample = 'comment';
          }

          // Detect table editing by checking if multiple table cells are selected
          // Single cell selection should use normal edit flow, only multi-cell uses table tool
          if (!sample) {
            // First check: selectedCells from TablePlugin (cell selection mode)
            const selectedCells =
              editor.getOption({ key: KEYS.table }, 'selectedCells') || [];

            if (selectedCells.length > 1) {
              sample = 'table';
            }
            // Second check: selection range spans multiple cells
            else if (body.ctx?.children && body.ctx?.selection) {
              const { selection, children } = body.ctx;
              const anchorPath = selection.anchor?.path;
              const focusPath = selection.focus?.path;

              if (anchorPath && anchorPath.length >= 3) {
                const rootIndex = anchorPath[0];
                const rootNode = children[rootIndex];

                if (rootNode?.type === 'table') {
                  // Cell path is at index 2 (table -> row -> cell)
                  const anchorCellPath = anchorPath.slice(0, 3).join(',');
                  const focusCellPath = focusPath?.slice(0, 3).join(',');

                  // Only use table mock if anchor and focus are in different cells
                  if (focusCellPath && anchorCellPath !== focusCellPath) {
                    sample = 'table';
                  }
                }
              }
            }
          }
        } catch {
          sample = null;
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        await new Promise((resolve) => setTimeout(resolve, 400));

        const { fakeStreamText } = await import('./use-chat-samples');
        const stream = fakeStreamText({
          editor,
          sample,
          signal: abortController.signal,
        });

        const response = new Response(stream, {
          headers: {
            Connection: 'keep-alive',
            'Content-Type': 'text/plain',
          },
        });

        return response;
      }

      return res;
    }) as typeof fetch,
  });
}

export const useChat = () => {
  const editor = useEditorRef();
  const options = usePluginOption(aiChatPlugin, 'chatOptions');

  // remove when you implement the route /api/ai/command
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const _abortFakeStream = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const transport = React.useMemo(
    () =>
      createChatTransport({
        api: options.api || '/api/ai/command',
        abortControllerRef,
        editor,
      }),
    [editor, options.api]
  );

  const baseChat = useBaseChat<ChatMessage>({
    id: 'editor',
    transport,
    onData(data) {
      if (data.type === 'data-toolName') {
        editor.setOption(AIChatPlugin, 'toolName', data.data as ToolName);
      }

      if (data.type === 'data-table' && data.data) {
        const tableData = data.data as TTableCellUpdate;

        if (tableData.status === 'finished') {
          const chatSelection = editor.getOption(AIChatPlugin, 'chatSelection');

          if (!chatSelection) return;

          editor.tf.setSelection(chatSelection);

          return;
        }

        const cellUpdate = tableData.cellUpdate!;

        withAIBatch(editor, () => {
          applyTableCellSuggestion(editor, cellUpdate);
        });
      }

      if (data.type === 'data-comment' && data.data) {
        const commentData = data.data as TComment;

        if (commentData.status === 'finished') {
          editor.getApi(BlockSelectionPlugin).blockSelection.deselect();

          return;
        }

        const aiComment = commentData.comment!;
        const range = aiCommentToRange(editor, aiComment);

        if (!range) return console.warn('No range found for AI comment');

        const discussions =
          editor.getOption(discussionPlugin, 'discussions') || [];

        // Generate a new discussion ID
        const discussionId = nanoid();

        // Create a new comment
        const newComment = {
          id: nanoid(),
          contentRich: [{ children: [{ text: aiComment.comment }], type: 'p' }],
          createdAt: new Date(),
          discussionId,
          isEdited: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        };

        // Create a new discussion
        const newDiscussion = {
          id: discussionId,
          comments: [newComment],
          createdAt: new Date(),
          documentContent: deserializeMd(editor, aiComment.content)
            .map((node: TNode) => NodeApi.string(node))
            .join('\n'),
          isResolved: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        };

        // Update discussions
        const updatedDiscussions = [...discussions, newDiscussion];
        editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);

        // Apply comment marks to the editor
        editor.tf.withMerging(() => {
          editor.tf.setNodes(
            {
              [getCommentKey(newDiscussion.id)]: true,
              [getTransientCommentKey()]: true,
              [KEYS.comment]: true,
            },
            {
              at: range,
              match: TextApi.isText,
              split: true,
            }
          );
        });
      }
    },

    ...options,
  });

  const chat = {
    ...baseChat,
    _abortFakeStream,
  };

  React.useEffect(() => {
    editor.setOption(AIChatPlugin, 'chat', chat as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.status, chat.messages, chat.error, _abortFakeStream]);

  return chat;
};
