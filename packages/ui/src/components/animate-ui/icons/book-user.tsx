'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `book-user`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The head lifts and the shoulders settle, as on Users.

type BookUserProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.05 } },
    },
    path2: {
      initial: {},
      animate: {},
    },
    circle: {
      initial: { y: 0 },
      animate: { y: [0, -1.5, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BookUserProps) {
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
        d="M15 13a3 3 0 1 0-6 0"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={12}
        cy={8}
        r={2}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function BookUser(props: BookUserProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  BookUser,
  BookUser as BookUserIcon,
  type BookUserProps,
  type BookUserProps as BookUserIconProps,
};
