import { extractSections } from "@specboard/core";
import { createDb, eq, features, specIndex, type Database } from "@specboard/db";

import type {
  FeatureDetail,
  FeaturePatch,
  FeatureRecord,
  FeatureStore,
} from "./types";

/** Postgres-backed store (self-host compose stack or managed Postgres). */
export class DbStore implements FeatureStore {
  private readonly db: Database;

  constructor(connectionString: string) {
    this.db = createDb(connectionString);
  }

  async listFeatures(): Promise<FeatureRecord[]> {
    const rows = await this.db.query.features.findMany({
      with: { index: true },
    });
    return rows.map((row) => ({
      specId: row.specId,
      title: row.title,
      status: row.status,
      priority: row.priority,
      tags: row.tags,
      roadmapQuarter: row.roadmapQuarter,
      path: row.index?.path ?? "",
    }));
  }

  async getFeature(specId: string): Promise<FeatureDetail | null> {
    const row = await this.db.query.features.findFirst({
      where: eq(features.specId, specId),
      with: { index: true },
    });
    if (!row) return null;
    const content = row.index?.content ?? "";
    return {
      specId: row.specId,
      title: row.title,
      status: row.status,
      priority: row.priority,
      tags: row.tags,
      roadmapQuarter: row.roadmapQuarter,
      path: row.index?.path ?? "",
      content,
      sections: extractSections(content),
    };
  }

  async updateFeature(specId: string, patch: FeaturePatch): Promise<void> {
    await this.db
      .update(features)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(features.specId, specId));
  }
}

export { specIndex };
