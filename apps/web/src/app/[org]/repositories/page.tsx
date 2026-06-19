import { redirect } from "next/navigation";

import { orgPath } from "@/lib/org-path";
import { currentOrgSlug } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

/**
 * Repositories moved under Settings. Preserve any callback/setup query params
 * (e.g. `?setup=done`) so bookmarked or external GitHub-callback links still
 * land on the right banner.
 */
export default async function RepositoriesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const query = qs.toString();
  const path = `/settings/repositories${query ? `?${query}` : ""}`;
  redirect(orgPath(await currentOrgSlug(), path));
}
