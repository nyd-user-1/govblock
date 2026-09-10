'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `calendar-days`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The six days blink in order.

type CalendarDaysProps = IconProps<keyof typeof animations>;

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
    rect: {
      initial: {},
      animate: {},
    },
    path3: {
      initial: {},
      animate: {},
    },
    path4: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.15, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path5: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.15, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.06 } },
    },
    path6: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.15, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.12 } },
    },
    path7: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.15, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.18 } },
    },
    path8: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.15, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.24 } },
    },
    path9: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.15, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.3 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CalendarDaysProps) {
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
        d="M8 2v3"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 2v3"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.rect
        x={3}
        y={3}
        width={18}
        height={18}
        rx={2}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 9h18"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M8 13h.01"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M12 13h.01"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 13h.01"
        variants={variants.path6}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M8 17h.01"
        variants={variants.path7}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M12 17h.01"
        variants={variants.path8}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 17h.01"
        variants={variants.path9}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function CalendarDays(props: CalendarDaysProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  CalendarDays,
  CalendarDays as CalendarDaysIcon,
  type CalendarDaysProps,
  type CalendarDaysProps as CalendarDaysIconProps,
};
