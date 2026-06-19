import { redirect } from "next/navigation";

import { orgPath } from "@/lib/org-path";

export const dynamic = "force-dynamic";

/** Bare `/{org}` → the org's board (its default landing area). */
export default async function OrgHome({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(orgPath(org, "/board"));
}
