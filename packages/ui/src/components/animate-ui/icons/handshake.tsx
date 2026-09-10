'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `handshake`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. One pump of the hands.

type HandshakeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, 1, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, 1, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path3: {
      initial: { y: 0 },
      animate: { y: [0, 1, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, 1, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path5: {
      initial: { y: 0 },
      animate: { y: [0, 1, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: HandshakeProps) {
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
        d="m11 17 2 2a1 1 0 1 0 3-3"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m21 3 1 11h-2"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 4h8"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Handshake(props: HandshakeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Handshake,
  Handshake as HandshakeIcon,
  type HandshakeProps,
  type HandshakeProps as HandshakeIconProps,
};
