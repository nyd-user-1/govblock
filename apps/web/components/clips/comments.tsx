"use client"

import * as React from "react"
import Link from "next/link"
import { BookmarkIcon, HeartIcon, MessageCircleIcon, MoreHorizontalIcon, SendIcon } from "lucide-react"

import { ReactionButton } from "@govblock/ui/components/animbits/reaction-button"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import { ClipMenu } from "./menu"
import { fmtAge, fmtCount, fmtWhen, type Clip, type Comment } from "./store"

// Instagram's post panel, as the page's right rail: the author with Follow
// and the menu, the caption as the first entry, the comments, the action row
// with the like count and the date, and a box to write in. Signed out, the
// box is a sentence with a sign-in link.

export function CommentsPanel({
  clip,
  comments,
  liked,
  saved,
  following,
  signedIn,
  onLike,
  onSave,
  onDelete,
  onFollow,
  onGoToPost,
  onPost,
  onLikeComment,
  likedComments,
  focusKey,
  className,
}: {
  clip: Clip | null
  comments: Comment[]
  liked: boolean
  saved: boolean
  following: boolean
  signedIn: boolean
  onLike: () => void
  onSave: () => void
  onDelete?: () => void
  onFollow: () => void
  onGoToPost: () => void
  onPost: (text: string) => void
  onLikeComment: (id: string) => void
  likedComments: Set<string>
  focusKey?: number
  className?: string
}) {
  const [text, setText] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (focusKey) inputRef.current?.focus()
  }, [focusKey])
  React.useEffect(() => setText(""), [clip?.id])

  if (!clip) return <div className={cn("flex items-center justify-center p-6 text-sm text-muted-foreground", className)}>Nothing playing.</div>
  const likes = clip.likes + (liked ? 1 : 0)

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <Avatar className="size-8">
          <AvatarImage src={clip.author.image ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="text-xs">{clip.author.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">{clip.author.handle}</span>
        {!clip.mine && (
          <>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={onFollow} className={cn("text-sm font-semibold", following ? "text-muted-foreground" : "text-sky-600 dark:text-sky-400")}>
              {following ? "Following" : "Follow"}
            </button>
          </>
        )}
        <ClipMenu clip={clip} onGoToPost={onGoToPost} onDelete={onDelete}>
          <button type="button" className="ml-auto flex size-8 items-center justify-center rounded-full hover:bg-accent" aria-label="More">
            <MoreHorizontalIcon className="size-5" />
          </button>
        </ClipMenu>
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <Row author={clip.author} at={clip.createdAt}>
          <span className="font-semibold">{clip.title}</span> {clip.caption}
        </Row>
        {comments.map((c) => (
          <Row key={c.id} author={c.author} at={c.at} likes={c.likes + (likedComments.has(c.id) ? 1 : 0)} liked={likedComments.has(c.id)} onLike={() => onLikeComment(c.id)}>
            {c.text}
          </Row>
        ))}
        {comments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>}
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-1">
          <span className={cn("flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent", liked && "text-red-500")}>
            <ReactionButton Icon={HeartIcon} size={24} isLiked={liked} onToggle={onLike} />
          </span>
          <IconButton onClick={() => inputRef.current?.focus()} label="Comment">
            <MessageCircleIcon className="size-6 -scale-x-100" />
          </IconButton>
          <IconButton onClick={onGoToPost} label="Share">
            <SendIcon className="size-6" />
          </IconButton>
          <span className="ml-auto flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent">
            <ReactionButton Icon={BookmarkIcon} size={24} isLiked={saved} colors={{ initial: "currentColor", liked: "currentColor" }} onToggle={onSave} />
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold">{fmtCount(likes)} likes</p>
        <p className="text-xs text-muted-foreground">{fmtWhen(clip.createdAt)}</p>
        {signedIn ? (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const t = text.trim()
              if (!t) return
              onPost(t)
              setText("")
            }}
          >
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <Button type="submit" variant="ghost" size="sm" className="text-sky-600 disabled:opacity-40 dark:text-sky-400" disabled={!text.trim()}>
              Post
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            <Link href="/auth" className="font-medium text-sky-600 dark:text-sky-400">
              Sign in
            </Link>{" "}
            to like or comment.
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ author, at, likes, liked, onLike, children }: { author: Comment["author"]; at: string; likes?: number; liked?: boolean; onLike?: () => void; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={author.image ?? undefined} alt="" className="object-cover" />
        <AvatarFallback className="text-xs">{author.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <p className="leading-snug">
          <span className="font-semibold">{author.handle}</span> <span className="text-muted-foreground">{fmtAge(at)}</span>
        </p>
        <p className="mt-0.5 leading-snug break-words">{children}</p>
        {onLike && (
          <p className="mt-1 text-xs text-muted-foreground">
            {likes ? `${likes} ${likes === 1 ? "like" : "likes"}` : ""}
            {likes ? " · " : ""}
            <button type="button" className="font-medium">
              Reply
            </button>
          </p>
        )}
      </div>
      {onLike && (
        <button type="button" onClick={onLike} className={cn("mt-1 self-start text-muted-foreground", liked && "text-red-500")} aria-label="Like comment">
          <HeartIcon className={cn("size-3.5", liked && "fill-current")} />
        </button>
      )}
    </div>
  )
}

function IconButton({ children, label, onClick, className }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent", className)}>
      {children}
    </button>
  )
}
