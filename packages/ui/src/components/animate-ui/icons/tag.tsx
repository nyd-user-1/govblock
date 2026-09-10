'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `tag`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The tag swings once on its hole.

type TagProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, 1, -0.5, 0], y: [0, -1, 0.5, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
    },
    circle: {
      initial: { x: 0, y: 0 },
      animate: { x: [0, 1, -0.5, 0], y: [0, -1, 0.5, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: TagProps) {
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
        d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={7.5}
        cy={7.5}
        r={.5}
        fill="currentColor"
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Tag(props: TagProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Tag,
  Tag as TagIcon,
  type TagProps,
  type TagProps as TagIconProps,
};
