"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { patchFeature } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { statusLabel, statusOptions } from "@/lib/feature-helpers";
import type { FeatureDetail } from "@/lib/store/types";

/** Metadata sidebar form; saves through the public /api/v1 surface. */
export function FeatureMetaForm({ feature }: { feature: FeatureDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const rawPriority = String(data.get("priority") ?? "");
    startTransition(async () => {
      setError(null);
      try {
        await patchFeature(feature.specId, {
          status: String(data.get("status") ?? feature.status),
          priority: rawPriority === "" ? null : Number(rawPriority),
          roadmapQuarter: String(data.get("roadmapQuarter") ?? "").trim() || null,
          tags: String(data.get("tags") ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Status
        </span>
        <Select name="status" defaultValue={feature.status} className="h-8">
          {statusOptions(feature.status).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Priority (0 = highest)
        </span>
        <Input
          name="priority"
          type="number"
          min={0}
          max={4}
          defaultValue={feature.priority ?? ""}
          className="h-8"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Roadmap quarter
        </span>
        <Input
          name="roadmapQuarter"
          placeholder="2026-Q3"
          defaultValue={feature.roadmapQuarter ?? ""}
          className="h-8"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Tags (comma-separated)
        </span>
        <Input
          name="tags"
          defaultValue={feature.tags.join(", ")}
          className="h-8"
        />
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save metadata"}
      </Button>
    </form>
  );
}
