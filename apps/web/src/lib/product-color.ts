import { resolveProductColor, type ProductColor } from "@specboard/core";

/**
 * Tailwind classes for each product accent color. Written as full literal
 * strings (not interpolated) so the JIT compiler keeps them — `bg-${c}-500`
 * would be purged. `dot` is a small filled swatch; `badge` is a soft pill that
 * adapts to dark mode.
 */
const COLOR_CLASSES: Record<ProductColor, { dot: string; badge: string }> = {
  slate: {
    dot: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
  },
  red: {
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  },
  orange: {
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
  amber: {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  green: {
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-300",
  },
  teal: {
    dot: "bg-teal-500",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  },
  sky: {
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  },
  blue: {
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  },
  violet: {
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
  pink: {
    dot: "bg-pink-500",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
  },
};

/** Swatch (`dot`) + pill (`badge`) classes for a product's resolved color. */
export function productColorClasses(p: { color?: string | null; key: string }): {
  dot: string;
  badge: string;
} {
  return COLOR_CLASSES[resolveProductColor(p)];
}

/** The swatch class for a specific palette token (for the color picker). */
export function colorDot(color: ProductColor): string {
  return COLOR_CLASSES[color].dot;
}
