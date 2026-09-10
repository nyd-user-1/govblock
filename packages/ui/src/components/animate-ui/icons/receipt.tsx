'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `receipt`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The dollar sign swells once.

type ReceiptProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.2, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.2, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path3: {
      initial: {},
      animate: {},
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ReceiptProps) {
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
        d="M12 17V7"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Receipt(props: ReceiptProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Receipt,
  Receipt as ReceiptIcon,
  type ReceiptProps,
  type ReceiptProps as ReceiptIconProps,
};
