'use client';

import { createPlatePlugin } from 'platejs/react';
import { BlockDiscussion } from '@/components/plate/ui/block-discussion';
import type { TComment } from '@/components/plate/ui/comment';
import { useBlockDiscussionStore } from '@/lib/block-discussion-index';

export type TDiscussion = {
  id: string;
  comments: TComment[];
  createdAt: Date;
  isResolved: boolean;
  userId: string;
  documentContent?: string;
  /** The top-level block the thread is anchored to: "b412". */
  block?: string;
};

const BLOCK_SUGGESTION_SELECTOR = '[data-block-suggestion="true"]';

const getTargetElement = (target: EventTarget | null) => {
  if (target instanceof HTMLElement) return target;
  if (target instanceof Node) return target.parentElement;

  return null;
};

export const getDiscussionClickTarget = ({
  selector,
  target,
}: {
  selector: string;
  target: EventTarget | null;
}) => {
  const element = getTargetElement(target);

  if (!element) return null;

  return element.closest(selector) as HTMLElement | null;
};

export const getDiscussionBlockClickTarget = ({
  selector = BLOCK_SUGGESTION_SELECTOR,
  target,
}: {
  selector?: string;
  target: EventTarget | null;
}) =>
  getDiscussionClickTarget({
    selector,
    target,
  });

export type DiscussionUser = { id: string; avatarUrl: string; name: string; hue?: number };

// The discussions a reader keeps on this document (sql/026_comments.sql,
// 2026-09-15), in place of the template's Alice, Bob and Charlie: loaded when
// the view opens (components/workspace/typeset-plate-comments.tsx) and written
// through /api/typeset/comments as each changes (comment.tsx). A reader sees
// only their own, so every comment here is "me"; signed out, `currentUserId`
// is null and the form offers sign-in instead.
export const discussionPlugin = createPlatePlugin({
  key: 'discussion',
  options: {
    currentUserId: null as string | null,
    discussions: [] as TDiscussion[],
    users: {} as Record<string, DiscussionUser>,
    /** Where the comments are kept: the document's key and its bill. Null keeps them in memory only. */
    document: null as string | null,
    billId: null as number | null,
  },
})
  .configure({
    render: { aboveNodes: BlockDiscussion },
    // Called, not referenced: the index module imports this one back.
    useHooks: () => useBlockDiscussionStore(),
  })
  .extendSelectors(({ getOption }) => ({
    currentUser: () => {
      const id = getOption('currentUserId');
      return id ? getOption('users')[id] : undefined;
    },
    user: (id: string) => getOption('users')[id],
  }));

export const DiscussionKit = [discussionPlugin];
