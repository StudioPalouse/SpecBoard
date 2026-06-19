import { randomUUID } from "node:crypto";

import {
  leafLevel,
  parentLevelKey,
  parseRepoConfigYaml,
  safeParseRepoConfig,
  type RepoConfig,
} from "@specboard/core";
import {
  and,
  eq,
  features,
  repositories,
  specIndex,
  workspaceLevels,
  type Database,
} from "@specboard/db";
import {
  createGitHubRepoClient,
  reconcileSpecs,
  type GitRepoClient,
} from "@specboard/git";

import { getGithubApp } from "@/lib/github-app";
import { ensureDefaultProduct } from "@/lib/workspace";

export type RepoRecord = typeof repositories.$inferSelect;

/** Path of the per-repo config file, relative to the repo root. */
const CONFIG_PATH = ".specboard/config.yml";

/** Default when a repo has no `.specboard/config.yml` glob override yet. */
const DEFAULT_SPEC_GLOBS = ["specs/**/spec.md"];

/** Outcome of syncing one repository. */
export interface SyncSummary {
  /** Specs whose content changed (or are new) and were written to the DB. */
  upserted: number;
  /** Specs already in sync (matching `blobSha`) that were left untouched. */
  skipped: number;
  /** Specs that had a stable id injected back into git during this sync. */
  idsInjected: number;
  /** Feature groupings auto-created to home newly-synced work items. */
  featuresCreated: number;
}

/**
 * The grouping key for a spec's Feature: its `feature` frontmatter when set,
 * else its folder path (so specs in the same directory share a Feature). Falls
 * back to a per-spec key for a spec at the repo root (keeps it 1:1).
 */
function featureKeyFor(frontmatterFeature: string | undefined, path: string, specId: string): string {
  const declared = frontmatterFeature?.trim();
  if (declared) return `feature:${declared}`;
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return dir ? `path:${dir}` : `spec:${specId}`;
}

/** Human label for an auto-created Feature, derived from its grouping key. */
function featureTitleFor(key: string, fallbackTitle: string): string {
  const raw = key.startsWith("feature:")
    ? key.slice("feature:".length)
    : key.startsWith("path:")
      ? key.slice(key.lastIndexOf("/") + 1)
      : "";
  const cleaned = raw.replace(/[-_]+/g, " ").trim();
  if (!cleaned) return fallbackTitle;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The spec globs configured for a repo, falling back to the default. */
export function repoGlobs(repo: RepoRecord): string[] {
  const config = repo.config as { specGlobs?: unknown } | null;
  const globs = config?.specGlobs;
  if (Array.isArray(globs) && globs.length > 0 && globs.every((g) => typeof g === "string")) {
    return globs as string[];
  }
  return DEFAULT_SPEC_GLOBS;
}

/**
 * Read and validate `.specboard/config.yml` from the repo, or `null` if it's
 * absent/unreadable (a repo without one falls back to defaults).
 */
async function readRepoConfigFromGit(client: GitRepoClient): Promise<RepoConfig | null> {
  try {
    const file = await client.readFile(CONFIG_PATH);
    return parseRepoConfigYaml(file.raw);
  } catch {
    return null;
  }
}

/**
 * The RepoConfig for a workspace's connected repo (the first one carrying a
 * stored config), or `null`. Drives config-derived UI such as custom fields.
 */
export async function getWorkspaceRepoConfig(
  db: Database,
  workspaceId: string,
): Promise<RepoConfig | null> {
  const rows = await db
    .select({ config: repositories.config })
    .from(repositories)
    .where(eq(repositories.workspaceId, workspaceId));
  for (const row of rows) {
    const config = safeParseRepoConfig(row.config);
    if (config) return config;
  }
  return null;
}

/** Find a connected repository by owner + name (case-sensitive, as GitHub stores them). */
export async function resolveRepository(
  db: Database,
  owner: string,
  name: string,
): Promise<RepoRecord | null> {
  const rows = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.owner, owner), eq(repositories.name, name)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Import/reconcile a repository's specs into the DB. Lists every spec via the
 * GitHub App, injects stable ids where missing (committed back to git by
 * `reconcileSpecs`), then upserts `features` + `spec_index`. Files whose
 * `blobSha` already matches the stored index are skipped — that's how a push
 * touching one spec doesn't rewrite the rest.
 *
 * All writes use the owner connection (`db` from `getDb()`): this is owner-side
 * data ingestion, not a tenant request, so it does not go through RLS.
 */
export async function syncRepository(db: Database, repo: RepoRecord): Promise<SyncSummary> {
  const app = await getGithubApp(db);
  if (!app) {
    throw new Error("GitHub App is not configured. Set it up on the Repositories page.");
  }

  const client = await createGitHubRepoClient(app, {
    installationId: repo.githubInstallationId,
    owner: repo.owner,
    name: repo.name,
    ref: repo.defaultBranch,
  });

  // Refresh the repo's config from git so glob/field changes take effect, and
  // resolve the globs to scan from it (falling back to the stored/default).
  const config = await readRepoConfigFromGit(client);
  if (config) {
    await db
      .update(repositories)
      .set({ config })
      .where(eq(repositories.id, repo.id));
  }
  const globs = config?.specGlobs ?? repoGlobs(repo);

  const reconciled = await reconcileSpecs(client, globs);

  // Synced specs land in the workspace's default product (until moved later).
  const productId = await ensureDefaultProduct(db, repo.workspaceId);

  // Specs are the spec-backed leaf; set the level explicitly from the
  // workspace's configured hierarchy rather than relying on the column default
  // (which can drift from a workspace that renamed its leaf). See ADR 0002.
  const levelRows = await db
    .select({
      key: workspaceLevels.key,
      label: workspaceLevels.label,
      position: workspaceLevels.position,
      isLeaf: workspaceLevels.isLeaf,
    })
    .from(workspaceLevels)
    .where(eq(workspaceLevels.workspaceId, repo.workspaceId));
  const levels = levelRows.length > 0 ? levelRows : null;
  const leafKey = leafLevel(levels).key;
  // The level a Feature grouping sits at (one above the spec leaf). Null only
  // for a single-level hierarchy, where there's nowhere to home work items.
  const featureLevelKey = parentLevelKey(leafKey, levels);

  // Existing blobShas keyed by specId, to skip unchanged files.
  const existingRows = await db
    .select({ specId: features.specId, blobSha: specIndex.blobSha })
    .from(features)
    .leftJoin(specIndex, eq(specIndex.featureId, features.id))
    .where(eq(features.repoId, repo.id));
  const existingBlob = new Map(existingRows.map((r) => [r.specId, r.blobSha]));

  const summary: SyncSummary = {
    upserted: 0,
    skipped: 0,
    idsInjected: 0,
    featuresCreated: 0,
  };

  await db.transaction(async (tx) => {
    for (const item of reconciled) {
      if (item.idInjected) summary.idsInjected += 1;

      const specId = item.spec.frontmatter.id;
      if (existingBlob.get(specId) === item.blobSha) {
        summary.skipped += 1;
        continue;
      }

      // features holds user-managed metadata (status/priority/…) — only the
      // git-derived title is reconciled here; the rest is preserved on update.
      const [row] = await tx
        .insert(features)
        .values({
          workspaceId: repo.workspaceId,
          repoId: repo.id,
          productId,
          specId,
          level: leafKey,
          title: item.spec.frontmatter.title,
        })
        // productId is set only on insert; an item moved to another product
        // later keeps its assignment across re-syncs. level is reconciled so a
        // spec row always converges to the current leaf.
        .onConflictDoUpdate({
          target: [features.repoId, features.specId],
          set: {
            title: item.spec.frontmatter.title,
            level: leafKey,
            updatedAt: new Date(),
          },
        })
        .returning({ id: features.id, parentId: features.parentId });
      if (!row) throw new Error(`Upsert returned no feature row for spec ${specId}`);

      // Home the work item under a Feature grouping. Only when it has no parent
      // yet — so a re-sync never overrides a parent a user set in the app. The
      // Feature is found (or created) by a stable grouping key so re-syncs and
      // sibling specs reuse it rather than spawning duplicates.
      if (featureLevelKey && row.parentId === null) {
        const key = featureKeyFor(item.spec.frontmatter.feature, item.path, specId);
        const existing = await tx
          .select({ id: features.id })
          .from(features)
          .where(
            and(
              eq(features.workspaceId, repo.workspaceId),
              eq(features.externalKey, key),
              eq(features.level, featureLevelKey),
            ),
          )
          .limit(1);
        let featureId = existing[0]?.id;
        if (!featureId) {
          const newId = randomUUID();
          await tx.insert(features).values({
            id: newId,
            workspaceId: repo.workspaceId,
            repoId: null,
            productId,
            specId: newId,
            level: featureLevelKey,
            externalKey: key,
            title: featureTitleFor(key, item.spec.frontmatter.title),
          });
          featureId = newId;
          summary.featuresCreated += 1;
        }
        await tx
          .update(features)
          .set({ parentId: featureId })
          .where(eq(features.id, row.id));
      }

      const parsed = { title: item.spec.frontmatter.title, sections: item.spec.sections };
      await tx
        .insert(specIndex)
        .values({
          featureId: row.id,
          path: item.path,
          blobSha: item.blobSha,
          content: item.spec.content,
          parsed,
        })
        .onConflictDoUpdate({
          target: specIndex.featureId,
          set: {
            path: item.path,
            blobSha: item.blobSha,
            content: item.spec.content,
            parsed,
            lastSyncedAt: new Date(),
          },
        });

      summary.upserted += 1;
    }
  });

  return summary;
}
