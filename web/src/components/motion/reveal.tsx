"use client";

import { motion, type Variants } from "framer-motion";

/**
 * DESIGN.md v3 §5: sections fade + rise on scroll into view, ease
 * [0.16, 1, 0.3, 1], 500-700ms, staggered ~80ms per child. Deliberately
 * parameterised (not one hardcoded variant reused everywhere) — the same
 * fade applied identically to every section is the reflex the spec calls out
 * as the tell; each section should be free to vary rise distance and delay.
 * `once: true` so a distribution list doesn't re-animate every scroll pass.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  rise = 16,
  duration = 0.6,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  rise?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: rise }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger a group of children — for feature grids, use-case pills, etc. */
export function RevealGroup({
  children,
  stagger = 0.08,
  className,
}: {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
}) {
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger } },
  };
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  rise = 14,
  className,
}: {
  children: React.ReactNode;
  rise?: number;
  className?: string;
}) {
  const item: Variants = {
    hidden: { opacity: 0, y: rise },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
