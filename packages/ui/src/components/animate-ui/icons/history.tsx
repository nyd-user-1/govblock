'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `history`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The hand draws from the centre out.

type HistoryProps = IconProps<keyof typeof animations>;

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
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: HistoryProps) {
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
        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 3v5h5"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M12 7v5l4 2"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function History(props: HistoryProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  History,
  History as HistoryIcon,
  type HistoryProps,
  type HistoryProps as HistoryIconProps,
};
