"use client";

import { usePathname } from "next/navigation";

import {
  ORG_SCOPED_SEGMENTS,
  orgPath,
  orgProductPath,
} from "@/lib/org-path";
import { ALL_PRODUCTS } from "@/lib/active-product";

/**
 * The active org slug, read from the first path segment. These hooks are only
 * used by components that render under an org route (`/{org}/…`), so the first
 * segment is always the org. See ADR 0001 (D3).
 */
export function useOrgSlug(): string {
  const pathname = usePathname();
  return pathname.split("/")[1] ?? "";
}

/**
 * Returns an org-aware href builder bound to the current org:
 * `const href = useOrgPath(); href("/board") → "/acme/board"`.
 */
export function useOrgPath(): (path?: string) => string {
  const org = useOrgSlug();
  return (path = "/") => orgPath(org, path);
}

/**
 * The active product slug from the URL (the second segment), or `ALL_PRODUCTS`
 * when there's no product in context — at the org root or on an org-scoped area
 * (settings / feature / repositories). Lets product-scoped nav links carry the
 * current product across areas, defaulting to "all products" elsewhere.
 */
export function useProductSlug(): string {
  const pathname = usePathname();
  const seg = pathname.split("/")[2] ?? "";
  if (!seg || ORG_SCOPED_SEGMENTS.has(seg)) return ALL_PRODUCTS;
  return seg;
}

/**
 * Org+product-aware href builder bound to the current org and product:
 * `const href = useOrgProductPath(); href("/board") → "/acme/web/board"`.
 */
export function useOrgProductPath(): (path?: string) => string {
  const org = useOrgSlug();
  const product = useProductSlug();
  return (path = "/") => orgProductPath(org, product, path);
}
