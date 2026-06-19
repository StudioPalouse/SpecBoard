ALTER TABLE "features" ADD COLUMN "external_key" text;--> statement-breakpoint
CREATE INDEX "features_external_key_idx" ON "features" USING btree ("workspace_id","external_key");