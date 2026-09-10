'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `mic`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The capsule pulses twice, as a live mic does.

type MicProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {},
      animate: {},
    },
    path2: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.6, 1], transition: { duration: 0.7, ease: 'easeInOut', delay: 0.1 } },
    },
    rect: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.4, 1, 0.4, 1], transition: { duration: 0.8, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MicProps) {
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
        d="M12 19v3"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.rect
        x={9}
        y={2}
        width={6}
        height={13}
        rx={3}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Mic(props: MicProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Mic,
  Mic as MicIcon,
  type MicProps,
  type MicProps as MicIconProps,
};
