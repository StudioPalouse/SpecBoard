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
}

/** The reserved key for the default product seeded on migration / first run. */
export const DEFAULT_PRODUCT_KEY = "default";

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
