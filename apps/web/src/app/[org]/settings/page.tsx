import { redirect } from "next/navigation";

import { orgPath } from "@/lib/org-path";
import { currentOrgSlug } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

/** Settings landing → the Profile sub-page. */
export default async function SettingsPage() {
  redirect(orgPath(await currentOrgSlug(), "/settings/profile"));
}
