'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `file-signature`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The pen scribbles and the line under it blinks.

type FileSignatureProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, 1, 0, 1, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
    },
    path2: {
      initial: {},
      animate: {},
    },
    path3: {
      initial: {},
      animate: {},
    },
    path4: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.3, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.1 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: FileSignatureProps) {
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
        d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M14.487 7.858A1 1 0 0 1 14 7V2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M8 18h1"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function FileSignature(props: FileSignatureProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  FileSignature,
  FileSignature as FileSignatureIcon,
  type FileSignatureProps,
  type FileSignatureProps as FileSignatureIconProps,
};
