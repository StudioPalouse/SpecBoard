import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FeatureGithubLinks } from "@/components/feature-github-links";
import { FeatureMetaForm } from "@/components/feature-meta-form";
import { FeatureRelations } from "@/components/feature-relations";
import { StatusDot } from "@/components/status-dot";
import { WorkItemControls } from "@/components/work-item-controls";
import {
  childLevelKey,
  parentLevelKey,
  resolveEstimateConfig,
  resolveWorkflow,
} from "@specboard/core";

import { ALL_PRODUCTS } from "@/lib/active-product";
import { getDb } from "@/lib/db";
import { statusLabel } from "@/lib/feature-helpers";
import { LOCAL_ORG_SLUG, orgProductPath } from "@/lib/org-path";
import { resolveRepoConfig } from "@/lib/repo-config";
import { getStore } from "@/lib/store";
import { canWrite, listWorkspaceMembers, type WorkspaceMember } from "@/lib/workspace";
import { requireWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

/**
 * Item detail: the spec markdown (canonical in git, leaf items only) beside the
 * metadata sidebar (status/priority/quarter/tags, persisted to the metadata
 * store). Grouping levels (initiative/epic/feature) have no spec of their own.
 *
 * The canonical permalink is `/{org}/{product}/backlog/{level}/{specId}` (ADR
 * 0002): the level key makes the item's type legible, and the specId is the
 * identity. We accept two shapes via this catch-all:
 *  - `[level, specId]` — render; redirect if the level segment is wrong.
 *  - `[specId]` — the old shallow permalink; 307-redirect to the typed shape.
 * A stale product segment also redirects to the item's current product (ADR
 * 0001 D5). Redirects are temporary — a feature can move products / its type is
 * derived per request — so the mapping must not be cached.
 */
export default async function ItemPage({
  params,
}: {
  params: Promise<{ org: string; product: string; slug: string[] }>;
}) {
  const access = await requireWorkspaceAccess();
  const org = access?.orgSlug ?? LOCAL_ORG_SLUG;
  const { product, slug } = await params;

  // Parse the catch-all: one segment is a bare specId (old link); two are
  // [levelKey, specId]; anything else isn't an item route.
  let levelSeg: string | null;
  let specId: string;
  if (slug.length === 1) {
    levelSeg = null;
    specId = slug[0]!;
  } else if (slug.length === 2) {
    levelSeg = slug[0]!;
    specId = slug[1]!;
  } else {
    notFound();
  }

  const store = await getStore();
  const feature = await store.getFeature(specId, access ?? undefined);
  if (!feature) notFound();

  // Canonicalize: the feature's current product is its context, and its level
  // key is the type segment. Redirect when either is stale/missing. `all` is
  // kept as-is so the cross-product view's links don't bounce on every click.
  const products = await store.listProducts(access ?? undefined);
  const productSlug =
    products.find((p) => p.id === feature.productId)?.key ?? ALL_PRODUCTS;
  const productStale = product !== productSlug && product !== ALL_PRODUCTS;
  if (productStale || levelSeg !== feature.level) {
    const targetProduct = product === ALL_PRODUCTS ? ALL_PRODUCTS : productSlug;
    redirect(
      orgProductPath(org, targetProduct, `/backlog/${feature.level}/${specId}`),
    );
  }
  const backlogHref = orgProductPath(org, product, "/backlog");

  // Assignee options + custom-field definitions for the metadata form.
  const db = getDb();
  const members: WorkspaceMember[] =
    access && db ? await listWorkspaceMembers(db, access.workspaceId) : [];
  const repoConfig = await resolveRepoConfig(access);
  const customFields = repoConfig?.fields ?? [];
  const estimateConfig = resolveEstimateConfig(repoConfig);
  const workflow = resolveWorkflow(repoConfig);

  // Other features the relation editor can point at (excluding this one).
  const allFeatures = await store.listFeatures(access ?? undefined);
  const candidates = allFeatures
    .filter((f) => f.specId !== feature.specId)
    .map((f) => ({ specId: f.specId, title: f.title }));

  // Hierarchy levels: label this item's level + scope the parent picker to the
  // one level above (and exclude descendants, which would form a cycle).
  const levels = await store.listLevels(access ?? undefined);
  const levelLabel =
    levels.find((l) => l.key === feature.level)?.label ?? feature.level;
  const parentKey = parentLevelKey(feature.level, levels);
  const childKey = childLevelKey(feature.level, levels);
  const childLabel = levels.find((l) => l.key === childKey)?.label ?? null;
  const descendants = descendantSpecIds(feature.specId, allFeatures);
  const parentCandidates = parentKey
    ? allFeatures
        .filter(
          (f) => f.level === parentKey && !descendants.has(f.specId),
        )
        .map((f) => ({ specId: f.specId, title: f.title }))
    : [];

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <article>
        <div className="mb-6 space-y-1">
          <Link
            href={backlogHref}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Backlog
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {levelLabel}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              {feature.title}
            </h1>
          </div>
          {feature.path ? (
            <p className="font-mono text-xs text-muted-foreground">
              {feature.path}
            </p>
          ) : null}
        </div>
        {feature.isDbNative ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {`This ${levelLabel.toLowerCase()} groups work — it has no spec of its own.`}
            {childLabel
              ? ` Add ${childLabel.toLowerCase()} items beneath it to build it out.`
              : ""}
          </div>
        ) : (
          <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert">
            <ReactMarkdown>{feature.content}</ReactMarkdown>
          </div>
        )}
      </article>

      <aside className="space-y-4 lg:border-l lg:pl-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StatusDot status={feature.status} />
          {statusLabel(feature.status)}
        </div>
        <Separator />
        <FeatureMetaForm
          feature={feature}
          members={members}
          customFields={customFields}
          candidates={parentCandidates}
          estimate={estimateConfig}
          workflow={workflow}
          canEdit={!access || canWrite(access.role)}
        />
        <Separator />
        {feature.parentSpecId || feature.children.length > 0 ? (
          <>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Hierarchy
              </span>
              {feature.parentSpecId && parentKey ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Parent: </span>
                  <Link
                    href={orgProductPath(
                      org,
                      product,
                      `/backlog/${parentKey}/${feature.parentSpecId}`,
                    )}
                    className="hover:underline"
                  >
                    {feature.parentTitle ?? feature.parentSpecId}
                  </Link>
                </p>
              ) : null}
              {feature.children.length > 0 && childKey ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Children · {feature.childDoneCount}/{feature.childCount} done
                  </p>
                  {feature.children.map((c) => (
                    <div key={c.specId} className="flex items-center gap-2 text-sm">
                      <StatusDot status={c.status} />
                      <Link
                        href={orgProductPath(
                          org,
                          product,
                          `/backlog/${childKey}/${c.specId}`,
                        )}
                        className="flex-1 truncate hover:underline"
                        title={c.title}
                      >
                        {c.title}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <Separator />
          </>
        ) : null}
        <FeatureRelations
          specId={feature.specId}
          relations={feature.relations}
          candidates={candidates}
          canEdit={!access || canWrite(access.role)}
        />
        <Separator />
        <FeatureGithubLinks
          specId={feature.specId}
          links={feature.githubLinks}
          canEdit={!access || canWrite(access.role)}
        />
        <Separator />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {feature.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            {feature.isDbNative ? "id" : "spec id"}: {feature.specId}
          </p>
        </div>
        {feature.isDbNative && (!access || canWrite(access.role)) ? (
          <>
            <Separator />
            <WorkItemControls
              specId={feature.specId}
              title={feature.title}
              levelLabel={levelLabel}
            />
          </>
        ) : null}
      </aside>
    </section>
  );
}

/** Spec ids of all features below `rootSpecId` in the parent/child tree. */
function descendantSpecIds(
  rootSpecId: string,
  features: { specId: string; parentSpecId: string | null }[],
): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const f of features) {
    if (!f.parentSpecId) continue;
    const arr = childrenOf.get(f.parentSpecId) ?? [];
    arr.push(f.specId);
    childrenOf.set(f.parentSpecId, arr);
  }
  const out = new Set<string>();
  const queue = [rootSpecId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of childrenOf.get(current) ?? []) {
      if (out.has(child)) continue; // guard against malformed cycles
      out.add(child);
      queue.push(child);
    }
  }
  return out;
}
