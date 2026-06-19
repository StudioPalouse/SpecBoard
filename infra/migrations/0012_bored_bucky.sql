CREATE TYPE "public"."product_member_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."product_visibility" AS ENUM('org', 'private');--> statement-breakpoint
CREATE TABLE "product_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "product_member_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_members_product_user_uq" UNIQUE("product_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" "product_visibility" DEFAULT 'org' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_ws_key_uq" UNIQUE("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_members_product_idx" ON "product_members" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_members_user_idx" ON "product_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "products_ws_idx" ON "products" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "features_product_idx" ON "features" USING btree ("product_id");--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill: one default product per workspace, carry the org name. Then move
-- every existing feature into it, and grant existing members access so the
-- product-scoped write rules preserve exactly what they can edit today
-- (admin → product admin; pm/ux/eng → editor; viewer → no grant, read-only).
-- Must run BEFORE the write policies below would otherwise gate inserts.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO "products" ("workspace_id","key","name","visibility","position")
SELECT w.id, 'default', w.name, 'org', 0
FROM "workspaces" w
ON CONFLICT ("workspace_id","key") DO NOTHING;
--> statement-breakpoint

UPDATE "features" f
SET "product_id" = p.id
FROM "products" p
WHERE p."workspace_id" = f."workspace_id"
  AND p."key" = 'default'
  AND f."product_id" IS NULL;
--> statement-breakpoint

INSERT INTO "product_members" ("workspace_id","product_id","user_id","role")
SELECT m."workspace_id", p.id, m."user_id",
  CASE WHEN m."role" = 'admin' THEN 'admin'::product_member_role
       ELSE 'editor'::product_member_role END
FROM "members" m
JOIN "products" p ON p."workspace_id" = m."workspace_id" AND p."key" = 'default'
WHERE m."role" IN ('admin','pm','ux','eng')
ON CONFLICT ("product_id","user_id") DO NOTHING;
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- Permission helper functions. Like specboard_is_member (migration 0002),
-- they read the per-transaction app.user_id session variable the app sets.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION specboard_is_org_admin(target_workspace uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.workspace_id = target_workspace
      AND m.user_id = nullif(current_setting('app.user_id', true), '')::uuid
      AND m.role = 'admin'
  );
$$;
--> statement-breakpoint

-- Read a product: must be a workspace member AND (the product is org-visible,
-- or you're an org admin, or you have any membership row on it). NULL product
-- (legacy/unassigned) is treated as org-visible to its members.
CREATE OR REPLACE FUNCTION specboard_can_read_product(p_workspace uuid, p_product uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT specboard_is_member(p_workspace) AND (
    p_product IS NULL
    OR specboard_is_org_admin(p_workspace)
    OR EXISTS (SELECT 1 FROM products pr WHERE pr.id = p_product AND pr.visibility = 'org')
    OR EXISTS (
      SELECT 1 FROM product_members pm
      WHERE pm.product_id = p_product
        AND pm.user_id = nullif(current_setting('app.user_id', true), '')::uuid
    )
  );
$$;
--> statement-breakpoint

-- Write a product's items: org admin, or an admin/editor member of the product.
CREATE OR REPLACE FUNCTION specboard_can_write_product(p_workspace uuid, p_product uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT specboard_is_member(p_workspace) AND (
    specboard_is_org_admin(p_workspace)
    OR EXISTS (
      SELECT 1 FROM product_members pm
      WHERE pm.product_id = p_product
        AND pm.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        AND pm.role IN ('admin','editor')
    )
  );
$$;
--> statement-breakpoint

-- Manage a product (settings + members): org admin, or a product admin.
CREATE OR REPLACE FUNCTION specboard_can_manage_product(p_workspace uuid, p_product uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT specboard_is_member(p_workspace) AND (
    specboard_is_org_admin(p_workspace)
    OR EXISTS (
      SELECT 1 FROM product_members pm
      WHERE pm.product_id = p_product
        AND pm.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        AND pm.role = 'admin'
    )
  );
$$;
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: products & product_members. Creating a product is an org-admin action;
-- managing an existing one (settings, members) is org-admin-or-product-admin.
-- Reads of a product (and its member list) respect its visibility.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY products_read ON "products"
  FOR SELECT USING (specboard_can_read_product(workspace_id, id));--> statement-breakpoint
CREATE POLICY products_insert ON "products"
  FOR INSERT WITH CHECK (specboard_is_org_admin(workspace_id));--> statement-breakpoint
CREATE POLICY products_update ON "products"
  FOR UPDATE USING (specboard_can_manage_product(workspace_id, id))
  WITH CHECK (specboard_can_manage_product(workspace_id, id));--> statement-breakpoint
CREATE POLICY products_delete ON "products"
  FOR DELETE USING (specboard_can_manage_product(workspace_id, id));--> statement-breakpoint

ALTER TABLE "product_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY product_members_read ON "product_members"
  FOR SELECT USING (specboard_can_read_product(workspace_id, product_id));--> statement-breakpoint
CREATE POLICY product_members_write ON "product_members"
  FOR ALL USING (specboard_can_manage_product(workspace_id, product_id))
  WITH CHECK (specboard_can_manage_product(workspace_id, product_id));--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: switch features (and its derived tables) to product-aware rules.
-- Reads are gated by product visibility; writes by product write access.
-- Derived tables join back to their feature's product. All products default
-- to 'org' visibility, so this is a no-op for existing data until a product
-- is made private (the toggle ships with the product UI).
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS features_member_all ON "features";--> statement-breakpoint
CREATE POLICY features_read ON "features"
  FOR SELECT USING (specboard_can_read_product(workspace_id, product_id));--> statement-breakpoint
CREATE POLICY features_insert ON "features"
  FOR INSERT WITH CHECK (specboard_can_write_product(workspace_id, product_id));--> statement-breakpoint
CREATE POLICY features_update ON "features"
  FOR UPDATE USING (specboard_can_write_product(workspace_id, product_id))
  WITH CHECK (specboard_can_write_product(workspace_id, product_id));--> statement-breakpoint
CREATE POLICY features_delete ON "features"
  FOR DELETE USING (specboard_can_write_product(workspace_id, product_id));--> statement-breakpoint

DROP POLICY IF EXISTS spec_index_member_all ON "spec_index";--> statement-breakpoint
CREATE POLICY spec_index_member_all ON "spec_index"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM features f
      WHERE f.id = spec_index.feature_id
        AND specboard_can_read_product(f.workspace_id, f.product_id)
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS comments_member_all ON "comments";--> statement-breakpoint
CREATE POLICY comments_read ON "comments"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM features f
      WHERE f.id = comments.feature_id
        AND specboard_can_read_product(f.workspace_id, f.product_id)
    )
  );--> statement-breakpoint
CREATE POLICY comments_write ON "comments"
  FOR ALL USING (specboard_is_member(workspace_id))
  WITH CHECK (specboard_is_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS activity_member_all ON "activity_log";--> statement-breakpoint
CREATE POLICY activity_member_all ON "activity_log"
  FOR ALL USING (
    specboard_is_member(workspace_id) AND (
      feature_id IS NULL
      OR EXISTS (
        SELECT 1 FROM features f
        WHERE f.id = activity_log.feature_id
          AND specboard_can_read_product(f.workspace_id, f.product_id)
      )
    )
  )
  WITH CHECK (specboard_is_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS feature_links ON "feature_links";--> statement-breakpoint
DROP POLICY IF EXISTS feature_links_member_all ON "feature_links";--> statement-breakpoint
CREATE POLICY feature_links_member_all ON "feature_links"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM features f
      WHERE f.id = feature_links.from_feature_id
        AND specboard_can_read_product(f.workspace_id, f.product_id)
    )
  )
  WITH CHECK (specboard_is_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS feature_github_links_member_all ON "feature_github_links";--> statement-breakpoint
CREATE POLICY feature_github_links_member_all ON "feature_github_links"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM features f
      WHERE f.id = feature_github_links.feature_id
        AND specboard_can_read_product(f.workspace_id, f.product_id)
    )
  )
  WITH CHECK (specboard_is_member(workspace_id));