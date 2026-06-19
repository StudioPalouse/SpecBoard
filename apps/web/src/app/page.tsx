import { redirect } from "next/navigation";

import { getServerSessionUser } from "@/lib/auth-session";
import { getDb } from "@/lib/db";
import { LOCAL_ORG_SLUG, orgPath } from "@/lib/org-path";
import { getWorkspaceById, resolveActiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Root redirect into the caller's active org. The bare `/` carries no org slug,
 * so we resolve the active workspace here and send the user to `/{org}/board`
 * (ADR 0001, D3). File mode (no auth) uses the fixed local slug.
 */
export default async function HomePage() {
  const db = getDb();
  if (!db) redirect(orgPath(LOCAL_ORG_SLUG, "/board"));

  const user = await getServerSessionUser();
  if (!user) redirect("/sign-in");

  const membership = await resolveActiveWorkspace(db, user.id);
  if (!membership) redirect("/setup");

  const workspace = await getWorkspaceById(db, membership.workspaceId);
  redirect(orgPath(workspace?.slug ?? LOCAL_ORG_SLUG, "/board"));
}
