'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `library`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The four books rise in turn, left to right.

type LibraryProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeInOut', delay: 0.24 } },
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeInOut', delay: 0.16 } },
    },
    path3: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeInOut', delay: 0.08 } },
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LibraryProps) {
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
        d="m16 6 4 14"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M12 6v14"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M8 8v12"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 4v16"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Library(props: LibraryProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Library,
  Library as LibraryIcon,
  type LibraryProps,
  type LibraryProps as LibraryIconProps,
};
