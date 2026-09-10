'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `tags`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The two tags part for a moment.

type TagsProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, 1, 0], y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, -1, 0], y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    circle: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, 1, 0], y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: TagsProps) {
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
        d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={10.5}
        cy={6.5}
        r={.5}
        fill="currentColor"
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Tags(props: TagsProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Tags,
  Tags as TagsIcon,
  type TagsProps,
  type TagsProps as TagsIconProps,
};
