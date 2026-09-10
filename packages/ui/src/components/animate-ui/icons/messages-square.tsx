'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `messages-square`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The two bubbles trade a nudge.

type MessagesSquareProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, -1, 0], y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, 1, 0], y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.05 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MessagesSquareProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function MessagesSquare(props: MessagesSquareProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  MessagesSquare,
  MessagesSquare as MessagesSquareIcon,
  type MessagesSquareProps,
  type MessagesSquareProps as MessagesSquareIconProps,
};
