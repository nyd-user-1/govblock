'use client';

import { getDraftCommentKey } from '@platejs/comment';
import { CommentPlugin } from '@platejs/comment/react';
import { getTransientSuggestionKey } from '@platejs/suggestion';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import {
  MessageSquareTextIcon,
  MessagesSquareIcon,
  PencilLineIcon,
} from 'lucide-react';
import { type AnyPluginConfig, type NodeEntry, PathApi } from 'platejs';
import type { PlateElementProps, RenderNodeWrapper } from 'platejs/react';
import {
  useEditorRef,
  usePluginOption,
  usePluginOptions,
} from 'platejs/react';
import * as React from 'react';
import { commentPlugin } from '@/components/plate/editor/plugins/comment-kit';
import type { TDiscussion } from '@/components/plate/editor/plugins/discussion-kit';
import { suggestionPlugin } from '@/components/plate/editor/plugins/suggestion-kit';
import { Button } from '@/components/plate/ui/button';
import { cn } from '@govblock/ui/lib/utils';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/plate/ui/popover';
import {
  type BlockDiscussionItems,
  blockDiscussionKey,
  useBlockDiscussionItems,
} from '@/lib/block-discussion-index';

import { BlockSuggestionCard, isResolvedSuggestion } from './block-suggestion';
import { Comment, CommentCreateForm } from './comment';

// Only a top-level block carries a discussion, so nested blocks get no wrapper.
export const BlockDiscussion: RenderNodeWrapper<AnyPluginConfig> = ({
  path,
}) => {
  if (path.length !== 1) return;

  return (props) => <BlockCommentContent {...props} />;
};

// What every block pays (typeset-perf, 2026-09-13): its own items from the
// discussion store and one boolean, so a keystroke elsewhere renders nothing
// here. The popover and its node walks mount only on a block that has
// something to show or is being commented on, beside the block's content
// rather than around it: wrapping the content remounted the whole block the
// moment Comment was clicked.
const BlockCommentContent = (props: PlateElementProps) => {
  const { children, editor, element } = props;
  const items = useBlockDiscussionItems(
    editor,
    blockDiscussionKey(editor, element)
  );
  const commenting = usePluginOptions(
    commentPlugin,
    (state) =>
      !!state.commentingBlock &&
      state.commentingBlock[0] === editor.api.findPath(element)?.[0]
  );

  const discussed =
    commenting ||
    items.resolvedDiscussions.length > 0 ||
    items.resolvedSuggestions.length > 0;

  return (
    <div className={cn('w-full', discussed && 'relative')}>
      {children}
      {discussed ? <BlockDiscussionPopover {...props} items={items} /> : null}
    </div>
  );
};

const BlockDiscussionPopover = ({
  element,
  items: { resolvedDiscussions, resolvedSuggestions },
}: PlateElementProps & { items: BlockDiscussionItems }) => {
  const editor = useEditorRef();
  const commentsApi = editor.getApi(CommentPlugin).comment;
  const blockPath = editor.api.findPath(element) ?? [];
  const isTopLevelBlock = blockPath.length === 1;
  const draftCommentNode = isTopLevelBlock
    ? commentsApi.node({ at: blockPath, isDraft: true })
    : undefined;
  const commentNodes = isTopLevelBlock
    ? [...commentsApi.nodes({ at: blockPath })]
    : [];
  const suggestionNodes = isTopLevelBlock
    ? [
        ...editor.getApi(SuggestionPlugin).suggestion.nodes({ at: blockPath }),
      ].filter(([node]) => !node[getTransientSuggestionKey()])
    : [];

  const suggestionsCount = resolvedSuggestions.length;
  const discussionsCount = resolvedDiscussions.length;
  const totalCount = suggestionsCount + discussionsCount;

  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const activeSuggestion =
    activeSuggestionId &&
    resolvedSuggestions.find((s) => s.suggestionId === activeSuggestionId);

  const commentingBlock = usePluginOption(commentPlugin, 'commentingBlock');
  const activeCommentId = usePluginOption(commentPlugin, 'activeId');
  const isCommenting = activeCommentId === getDraftCommentKey();
  const activeDiscussion =
    activeCommentId &&
    resolvedDiscussions.find((d) => d.id === activeCommentId);

  const noneActive = !activeSuggestion && !activeDiscussion;

  const sortedMergedData = [
    ...resolvedDiscussions,
    ...resolvedSuggestions,
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const selected =
    resolvedDiscussions.some((d) => d.id === activeCommentId) ||
    resolvedSuggestions.some((s) => s.suggestionId === activeSuggestionId);

  const [_open, setOpen] = React.useState(selected);

  // in some cases, we may comment the multiple blocks
  const commentingCurrent =
    !!commentingBlock && PathApi.equals(blockPath, commentingBlock);

  const open =
    _open ||
    selected ||
    (isCommenting && !!draftCommentNode && commentingCurrent);

  const anchorElement = React.useMemo(() => {
    let activeNode: NodeEntry | undefined;

    if (activeSuggestion) {
      activeNode = suggestionNodes.find(
        ([node]) =>
          editor.getApi(SuggestionPlugin).suggestion.nodeId(node) ===
          activeSuggestion.suggestionId
      );
    }

    if (activeCommentId) {
      if (activeCommentId === getDraftCommentKey()) {
        activeNode = draftCommentNode;
      } else {
        activeNode = commentNodes.find(
          ([node]) =>
            editor.getApi(commentPlugin).comment.nodeId(node) ===
            activeCommentId
        );
      }
    }

    if (!activeNode) return null;

    return editor.api.toDOMNode(activeNode[0])!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    activeSuggestion,
    activeCommentId,
    editor.api,
    suggestionNodes,
    draftCommentNode,
    commentNodes,
  ]);

  if (!isTopLevelBlock) return null;

  if (suggestionsCount + resolvedDiscussions.length === 0 && !draftCommentNode)
    return null;

  return (
    <Popover
      onOpenChange={(_open_) => {
        if (!_open_ && isCommenting && draftCommentNode) {
          editor.tf.unsetNodes(getDraftCommentKey(), {
            at: [],
            mode: 'lowest',
            match: (n) => n[getDraftCommentKey()],
          });
        }
        setOpen(_open_);
      }}
      open={open}
    >
      {anchorElement && (
        <PopoverAnchor
          asChild
          className="w-full"
          virtualRef={{ current: anchorElement }}
        />
      )}

      <PopoverContent
        align="center"
        className="max-h-[min(50dvh,calc(-24px+var(--radix-popper-available-height)))] w-[380px] min-w-[130px] max-w-[calc(100vw-24px)] overflow-y-auto p-0 data-[state=closed]:opacity-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        side="bottom"
      >
        {isCommenting ? (
          <CommentCreateForm className="p-4" focusOnMount />
        ) : noneActive ? (
          sortedMergedData.map((item, index) =>
            isResolvedSuggestion(item) ? (
              <BlockSuggestionCard
                idx={index}
                isLast={index === sortedMergedData.length - 1}
                key={item.suggestionId}
                suggestion={item}
              />
            ) : (
              <BlockComment
                discussion={item}
                isLast={index === sortedMergedData.length - 1}
                key={item.id}
              />
            )
          )
        ) : (
          <>
            {activeSuggestion && (
              <BlockSuggestionCard
                idx={0}
                isLast={true}
                key={activeSuggestion.suggestionId}
                suggestion={activeSuggestion}
              />
            )}

            {activeDiscussion && (
              <BlockComment discussion={activeDiscussion} isLast={true} />
            )}
          </>
        )}
      </PopoverContent>

      {totalCount > 0 && (
        <div className="absolute top-0 left-full size-0 select-none">
          <PopoverTrigger asChild>
            <Button
              className="!px-1.5 mt-1 ml-1 flex h-6 gap-1 py-0 text-muted-foreground/80 hover:text-muted-foreground/80 data-[active=true]:bg-muted"
              contentEditable={false}
              data-active={open}
              variant="ghost"
            >
              {suggestionsCount > 0 && discussionsCount === 0 && (
                <PencilLineIcon className="size-4 shrink-0" />
              )}

              {suggestionsCount === 0 && discussionsCount > 0 && (
                <MessageSquareTextIcon className="size-4 shrink-0" />
              )}

              {suggestionsCount > 0 && discussionsCount > 0 && (
                <MessagesSquareIcon className="size-4 shrink-0" />
              )}

              <span className="font-semibold text-xs">{totalCount}</span>
            </Button>
          </PopoverTrigger>
        </div>
      )}
    </Popover>
  );
};

function BlockComment({
  discussion,
  isLast,
}: {
  discussion: TDiscussion;
  isLast: boolean;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <React.Fragment key={discussion.id}>
      <div className="p-4">
        {discussion.comments.map((comment, index) => (
          <Comment
            comment={comment}
            discussionLength={discussion.comments.length}
            documentContent={discussion?.documentContent}
            editingId={editingId}
            index={index}
            key={comment.id ?? index}
            setEditingId={setEditingId}
            showDocumentContent
          />
        ))}
        <CommentCreateForm discussionId={discussion.id} />
      </div>

      {!isLast && <div className="h-px w-full bg-muted" />}
    </React.Fragment>
  );
}
