import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerSessionUser } from "@/lib/auth-session";
import { getDb } from "@/lib/db";
import { LOCAL_ORG_SLUG } from "@/lib/org-path";
import type { WorkspaceScope } from "@/lib/store/types";
import {
  getWorkspaceById,
  listMembershipsForUser,
  resolveActiveWorkspace,
  type MemberRole,
} from "@/lib/workspace";

/** Tenant scope, the caller's role, and the active org slug for a content page. */
export type PageAccess = WorkspaceScope & { role: MemberRole; orgSlug: string };

/**
 * Whether the viewer can connect a GitHub repository (admin-only). `null`
 * access is local file mode, where repo connection isn't a concept.
 */
export function canConnectRepos(access: PageAccess | null): boolean {
  return access?.role === "admin";
}

/**
 * The signed-in user's orgs for the sidebar switcher. Returns `[]` when there's
 * nothing to switch between (no session, file mode, or a single org), so the
 * switcher stays hidden outside true multi-org membership.
 */
export async function listSidebarOrgs(): Promise<
  { slug: string; name: string }[]
> {
  const db = getDb();
  if (!db) return [];
  const user = await getServerSessionUser();
  if (!user) return [];
  const memberships = await listMembershipsForUser(db, user.id);
  if (memberships.length < 2) return [];
  const orgs = await Promise.all(
    memberships.map(async (m) => {
      const ws = await getWorkspaceById(db, m.workspaceId);
      return ws ? { slug: ws.slug, name: ws.name } : null;
    }),
  );
  return orgs.filter((o): o is { slug: string; name: string } => o !== null);
}

/**
 * The active org slug for the current request, read from the `x-org-slug`
 * header set by middleware (the first URL path segment). Empty at the root
 * (`/`); falls back to the local slug in file mode. See ADR 0001 (D3).
 */
export async function currentOrgSlug(): Promise<string> {
  return (await headers()).get("x-org-slug") || LOCAL_ORG_SLUG;
}

/**
 * Page-level access gate for content routes (`/{org}/…`). When auth is enabled:
 * - no session              → redirect to /sign-in
 * - session, no workspace   → redirect to /setup (first user names the org)
 * - org slug not a member's → 404 (the URL is only a hint; authority is the
 *   validated membership — ADR 0001 D2/D3)
 *
 * Returns the tenant scope (+ role + org slug) to pass to the store, or `null`
 * in local file mode (auth disabled), where pages are ungated and unscoped.
 */
export async function requireWorkspaceAccess(): Promise<PageAccess | null> {
  const db = getDb();
  const user = await getServerSessionUser();
  if (!db) return null; // file mode — no auth, no gating
  if (!user) redirect("/sign-in");

  const orgSlug = (await headers()).get("x-org-slug") || undefined;
  const membership = await resolveActiveWorkspace(db, user.id, { orgSlug });
  if (!membership) {
    // A slug that names no org the caller belongs to → not found. No slug means
    // the bare root or first-run, which belongs at /setup.
    if (orgSlug) notFound();
    redirect("/setup");
  }

  const workspace = await getWorkspaceById(db, membership.workspaceId);
  return {
    userId: user.id,
    workspaceId: membership.workspaceId,
    role: membership.role,
    orgSlug: workspace?.slug ?? orgSlug ?? LOCAL_ORG_SLUG,
  };
}
