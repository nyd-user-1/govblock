'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `file-down`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The arrow drops and returns.

type FileDownProps = IconProps<keyof typeof animations>;

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
      initial: { y: 0 },
      animate: { y: [0, 2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, 2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: FileDownProps) {
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
        d="M12 18v-6"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m9 15 3 3 3-3"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function FileDown(props: FileDownProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  FileDown,
  FileDown as FileDownIcon,
  type FileDownProps,
  type FileDownProps as FileDownIconProps,
};
