"use client";

import { usePathname } from "next/navigation";

import { orgPath } from "@/lib/org-path";

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
