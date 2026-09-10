'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `inbox`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The box lifts and the tray drops, as something lands in it.

type InboxProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    polyline: {
      initial: { y: 0 },
      animate: { y: [0, 1.5, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.05 } },
    },
    path: {
      initial: { y: 0 },
      animate: { y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: InboxProps) {
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
      <motion.polyline
        points="22 12 16 12 14 15 10 15 8 12 2 12"
        variants={variants.polyline}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Inbox(props: InboxProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Inbox,
  Inbox as InboxIcon,
  type InboxProps,
  type InboxProps as InboxIconProps,
};
