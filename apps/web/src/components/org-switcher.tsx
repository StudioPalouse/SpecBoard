"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/select";
import { orgPath } from "@/lib/org-path";
import { useOrgSlug } from "@/lib/use-org";

/**
 * Org switcher at the top of the sidebar. Hidden unless the user belongs to ≥2
 * orgs (the single-tenant / one-org case has nothing to switch). Selecting an
 * org navigates to its board; the product context resets with the org. See
 * ADR 0001 (D3).
 */
export function OrgSwitcher({
  orgs,
}: {
  orgs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const active = useOrgSlug();

  if (orgs.length < 2) return null;

  return (
    <Select
      aria-label="Switch organization"
      value={active}
      onChange={(e) => router.push(orgPath(e.target.value, "/board"))}
      className="h-8 text-sm"
    >
      {orgs.map((org) => (
        <option key={org.slug} value={org.slug}>
          {org.name}
        </option>
      ))}
    </Select>
  );
}
