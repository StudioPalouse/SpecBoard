ALTER TABLE "features" DROP CONSTRAINT "features_repo_id_repositories_id_fk";
--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;