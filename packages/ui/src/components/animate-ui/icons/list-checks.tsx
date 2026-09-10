'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `list-checks`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The two checks draw, top then bottom.

type ListChecksProps = IconProps<keyof typeof animations>;

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
      initial: {},
      animate: {},
    },
    path4: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.4, ease: 'easeInOut', delay: 0.2 } },
    },
    path5: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.4, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ListChecksProps) {
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
        d="M13 5h8"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M13 12h8"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M13 19h8"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m3 17 2 2 4-4"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m3 7 2 2 4-4"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function ListChecks(props: ListChecksProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  ListChecks,
  ListChecks as ListChecksIcon,
  type ListChecksProps,
  type ListChecksProps as ListChecksIconProps,
};
