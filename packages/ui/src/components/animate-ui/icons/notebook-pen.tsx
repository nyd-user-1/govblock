'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `notebook-pen`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The pen writes: it draws in, and the rings on the spine nudge down the page.

type NotebookPenProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {},
      animate: {},
    },
    path2: {
      initial: { x: 0 },
      animate: { x: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path3: {
      initial: { x: 0 },
      animate: { x: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.06 } },
    },
    path4: {
      initial: { x: 0 },
      animate: { x: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.12 } },
    },
    path5: {
      initial: { x: 0 },
      animate: { x: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.18 } },
    },
    path6: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: NotebookPenProps) {
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
        d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2 6h4"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2 10h4"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2 14h4"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2 18h4"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"
        variants={variants.path6}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function NotebookPen(props: NotebookPenProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  NotebookPen,
  NotebookPen as NotebookPenIcon,
  type NotebookPenProps,
  type NotebookPenProps as NotebookPenIconProps,
};
