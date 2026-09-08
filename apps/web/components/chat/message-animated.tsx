"use client"

import * as React from "react"
import { BrainIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import type { MessageAnimationPreset } from "@/lib/chat/message-animations"
import { MESSAGE_ANIMATIONS } from "@/lib/chat/message-animations"
import { Bubble, BubbleContent } from "@govblock/ui/components/nova/bubble"
import { Message, MessageContent } from "@govblock/ui/components/nova/message"
import { MessageScrollerItem } from "@govblock/ui/components/nova/message-scroller"

// Ported from livingston-v3 apps/v4/components/message-animated.tsx. A turn
// that slides in when it arrives and stands still when it is only being
// re-rendered — the reader's turns animate, the assistant's stream in place.
// `children` is what this chat adds under the text: the run's steps and the
// Filer's widgets. The AI SDK parts array is gone; a turn here is text, and
// optionally reasoning.

type MessageAnimatedMessage = {
  id: string
  role: "user" | "assistant"
  text?: string
  reasoning?: string
}

const MotionMessageScrollerItem = motion.create(MessageScrollerItem)

function MessageAnimated({
  message,
  animationPreset = MESSAGE_ANIMATIONS["slide-up"],
  assistantVariant = "ghost",
  scrollAnchor,
  userVariant = "muted",
  children,
  text,
  ...props
}: Omit<React.ComponentProps<typeof MotionMessageScrollerItem>, "animate" | "children" | "exit" | "initial" | "messageId" | "variants"> & {
  animationPreset?: MessageAnimationPreset
  assistantVariant?: React.ComponentProps<typeof Bubble>["variant"]
  message: MessageAnimatedMessage
  userVariant?: React.ComponentProps<typeof Bubble>["variant"]
  /** Rendered in place of the plain paragraphs — the chat's own prose renderer. */
  text?: React.ReactNode
  children?: React.ReactNode
}) {
  const shouldReduceMotion = useReducedMotion()
  const isUserMessage = message.role === "user"

  const row = (
    <MessageAnimatedRow message={message} assistantVariant={assistantVariant} userVariant={userVariant} text={text}>
      {children}
    </MessageAnimatedRow>
  )

  if (isUserMessage) {
    return (
      <MotionMessageScrollerItem
        messageId={message.id}
        scrollAnchor={scrollAnchor ?? true}
        variants={animationPreset.variants}
        initial={shouldReduceMotion ? false : "initial"}
        animate="animate"
        exit={shouldReduceMotion ? undefined : "exit"}
        {...props}
      >
        {row}
      </MotionMessageScrollerItem>
    )
  }

  return (
    <MotionMessageScrollerItem messageId={message.id} scrollAnchor={scrollAnchor} initial={false} {...props}>
      {row}
    </MotionMessageScrollerItem>
  )
}

function MessageAnimatedRow({
  message,
  assistantVariant,
  userVariant,
  text,
  children,
}: {
  assistantVariant: React.ComponentProps<typeof Bubble>["variant"]
  message: MessageAnimatedMessage
  userVariant: React.ComponentProps<typeof Bubble>["variant"]
  text?: React.ReactNode
  children?: React.ReactNode
}) {
  const isUserMessage = message.role === "user"
  const paragraphs = (message.text ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <Message align={isUserMessage ? "end" : "start"}>
      <MessageContent>
        {message.reasoning ? (
          <div className="w-full border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
              <BrainIcon className="size-3.5" />
              Reasoning
            </div>
            <div className="space-y-1.5 text-sm">
              {message.reasoning
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
            </div>
          </div>
        ) : null}
        {!isUserMessage && children}
        {(text || paragraphs.length > 0) && (
          <Bubble variant={isUserMessage ? userVariant : assistantVariant}>
            <BubbleContent className="space-y-2">
              {text ??
                paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
            </BubbleContent>
          </Bubble>
        )}
        {isUserMessage && children}
      </MessageContent>
    </Message>
  )
}

export { MessageAnimated, type MessageAnimatedMessage }
