'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `file-text`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The three lines of the bill write themselves in, top to bottom.

type FileTextProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {},
      animate: {},
    },
    path2: {
      initial: {},
      animate: {},
    },
    path3: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path4: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.1 } },
    },
    path5: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.2 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: FileTextProps) {
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
        d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M14 2v5a1 1 0 0 0 1 1h5"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M10 9H8"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 13H8"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 17H8"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function FileText(props: FileTextProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  FileText,
  FileText as FileTextIcon,
  type FileTextProps,
  type FileTextProps as FileTextIconProps,
};
