import { getDb } from "@/lib/db";
import { getWorkspaceById } from "@/lib/workspace";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { CompanyCard } from "@/components/settings-form";

export const dynamic = "force-dynamic";

/** Organization details (admins can edit). Team management lands here next. */
export default async function CompanySettingsPage() {
  const access = await requireWorkspaceAccess();
  const db = getDb();

  if (!access || !db) {
    return (
      <p className="text-sm text-muted-foreground">
        Company settings are unavailable in local file mode.
      </p>
    );
  }

  const workspace = await getWorkspaceById(db, access.workspaceId);

  return (
    <div className="space-y-6">
      <CompanyCard name={workspace?.name ?? ""} canEdit={access.role === "admin"} />
      <p className="text-sm text-muted-foreground">
        Team member management is coming soon.
      </p>
    </div>
  );
}
