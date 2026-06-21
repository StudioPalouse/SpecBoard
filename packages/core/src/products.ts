/**
 * Products: sibling backlogs within an organization (the workspace). Each
 * product holds its own work-tracking hierarchy (see `levels`). This module is
 * the framework-agnostic shape + small helpers; the rows themselves live in the
 * `products` table and permission rules live in `permissions`.
 */

/** A product's read visibility (see `permissions`). */
export type ProductVisibility = "org" | "private";

export interface Product {
  id: string;
  /** Stable slug used in the `?product=` URL and as the per-workspace key. */
  key: string;
  name: string;
  description: string | null;
  visibility: ProductVisibility;
  /** Manual ordering in the product switcher; ascending. */
  position: number;
  /** Chosen accent color token (see `PRODUCT_COLORS`), or null to derive one
   * deterministically from the key via `resolveProductColor`. */
  color: string | null;
}

/** The reserved key for the default product seeded on migration / first run. */
export const DEFAULT_PRODUCT_KEY = "default";

/**
 * The accent-color palette a product can be tagged with. Stored as a stable
 * token (not a hex value) so the UI maps it to theme-aware classes and the set
 * stays closed/validatable. Order also drives the deterministic fallback.
 */
export const PRODUCT_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "sky",
  "blue",
  "violet",
  "pink",
] as const;

export type ProductColor = (typeof PRODUCT_COLORS)[number];

/**
 * The product's accent color: its explicit `color` when set to a known token,
 * otherwise one derived deterministically from its `key` so every product is
 * visually distinct out of the box (no backfill) yet stable across renders.
 */
export function resolveProductColor(p: {
  color?: string | null;
  key: string;
}): ProductColor {
  if (p.color && (PRODUCT_COLORS as readonly string[]).includes(p.color)) {
    return p.color as ProductColor;
  }
  let hash = 0;
  for (let i = 0; i < p.key.length; i++) {
    hash = (hash * 31 + p.key.charCodeAt(i)) >>> 0;
  }
  return PRODUCT_COLORS[hash % PRODUCT_COLORS.length] ?? PRODUCT_COLORS[0];
}

const KEY_MAX = 48;

/**
 * Derive a stable product key from a name, unique against `taken`. Mirrors the
 * level/workspace slug helpers so URLs stay readable.
 */
export function productKeyFromName(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, KEY_MAX) || "product";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  return key;
}
