import { resolveEstimateConfig, resolveWorkflow } from "@specboard/core";

import { BoardClient } from "@/app/board/board-client";
import { CardFieldsMenu } from "@/components/card-fields-menu";
import { EmptyState } from "@/components/empty-state";
import { WorkViewTabs } from "@/components/work-view-tabs";
import { getBoardPreferences } from "@/lib/board-preferences-service";
import { cardFieldCatalog, resolveCardFields } from "@/lib/card-fields";
import { getDb } from "@/lib/db";
import { resolveRepoConfig } from "@/lib/repo-config";
import { getStore } from "@/lib/store";
import { canWrite, listWorkspaceMembers, type WorkspaceMember } from "@/lib/workspace";
import { canConnectRepos, requireWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

/** Kanban board: drag cards to reorder / change status, click to edit inline. */
export default async function BoardPage() {
  const access = await requireWorkspaceAccess();
  const canEdit = !access || canWrite(access.role);

  const repoConfig = await resolveRepoConfig(access);
  const workflow = resolveWorkflow(repoConfig);
  const estimate = resolveEstimateConfig(repoConfig);
  const customFields = repoConfig?.fields ?? [];
  const columns = workflow.statuses.filter((s) => s !== "archived");

  const store = await getStore();
  const features = await store.listFeatures(access ?? undefined);

  const db = getDb();
  const members: WorkspaceMember[] =
    access && db ? await listWorkspaceMembers(db, access.workspaceId) : [];
  const memberNames = Object.fromEntries(members.map((m) => [m.userId, m.name]));

  const prefs = await getBoardPreferences(access ?? undefined);
  const catalog = cardFieldCatalog(customFields);
  const { fields: cardFields, featured } = resolveCardFields(prefs, catalog);
  const customFieldLabels = Object.fromEntries(
    customFields.map((f) => [f.key, f.label]),
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <WorkViewTabs />
        {features.length > 0 && canEdit ? (
          <CardFieldsMenu
            catalog={catalog}
            customFields={customFields.map((f) => ({ key: f.key, label: f.label }))}
            selected={cardFields}
            featured={featured}
          />
        ) : null}
      </div>
      {features.length === 0 ? (
        <EmptyState canConnect={canConnectRepos(access)} />
      ) : (
        <BoardClient
          features={features}
          columns={columns}
          workflow={workflow}
          canEdit={canEdit}
          cardFields={cardFields}
          featured={featured}
          customFieldLabels={customFieldLabels}
          memberNames={memberNames}
          members={members}
          customFields={customFields}
          estimate={estimate}
        />
      )}
    </section>
  );
}
