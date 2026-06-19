/**
 * Build an org-scoped app path: `orgPath("acme", "/board") → "/acme/board"`.
 * Pure and isomorphic (safe in server and client code). The org segment is the
 * URL tenancy prefix from ADR 0001 (D3).
 */
export function orgPath(org: string, path = "/"): string {
  const rest = path.startsWith("/") ? path : `/${path}`;
  // Avoid a trailing slash for the org root ("/acme", not "/acme/").
  return rest === "/" ? `/${org}` : `/${org}${rest}`;
}

/** Slug used for the single, local org in auth-disabled file mode. */
export const LOCAL_ORG_SLUG = "local";
