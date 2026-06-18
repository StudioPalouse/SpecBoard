-- Configurable work-tracking hierarchy levels (Initiative → Epic → Feature).
-- workspace_levels holds each workspace's levels; features.level is a composite
-- FK into (workspace_id, key). Spec-backed rows stay the leaf ("feature");
-- DB-native initiatives/epics get NULL repo_id (spec_id is set = row id by the
-- app so routing stays uniform).
--
-- Ordering matters: the levels must be seeded for every existing workspace
-- BEFORE the composite FK is added, or the FK validation fails on existing
-- feature rows (which all backfill to level 'feature').

CREATE TABLE "workspace_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"is_leaf" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_levels_ws_key_uq" UNIQUE("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "workspace_levels" ADD CONSTRAINT "workspace_levels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_levels_ws_idx" ON "workspace_levels" USING btree ("workspace_id");--> statement-breakpoint

-- Seed the default three levels for every existing workspace.
INSERT INTO "workspace_levels" ("workspace_id","key","label","position","is_leaf")
SELECT w.id, v.key, v.label, v.position, v.is_leaf
FROM "workspaces" w
CROSS JOIN (VALUES
  ('initiative','Initiative',0,false),
  ('epic','Epic',1,false),
  ('feature','Feature',2,true)
) AS v("key","label","position","is_leaf")
ON CONFLICT ("workspace_id","key") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "features" ALTER COLUMN "repo_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "level" text DEFAULT 'feature' NOT NULL;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_workspace_level_fk" FOREIGN KEY ("workspace_id","level") REFERENCES "public"."workspace_levels"("workspace_id","key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "features_workspace_level_idx" ON "features" USING btree ("workspace_id","level");--> statement-breakpoint

-- RLS: workspace_levels carries workspace_id directly (mirrors features).
ALTER TABLE "workspace_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_levels_member_all ON "workspace_levels"
  FOR ALL USING (specboard_is_member(workspace_id))
  WITH CHECK (specboard_is_member(workspace_id));
