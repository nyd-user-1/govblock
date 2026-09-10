'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `rss`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The signal rings outward: the dot, then each arc in turn.

type RssProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.3, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.1 } },
    },
    path2: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.3, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.22 } },
    },
    circle: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.4, 1], transition: { duration: 0.4, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: RssProps) {
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
        d="M4 11a9 9 0 0 1 9 9"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 4a16 16 0 0 1 16 16"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={5}
        cy={19}
        r={1}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Rss(props: RssProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Rss,
  Rss as RssIcon,
  type RssProps,
  type RssProps as RssIconProps,
};
