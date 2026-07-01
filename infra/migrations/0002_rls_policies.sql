-- RLS policies for Specboard multi-tenant isolation.
--
-- A row is visible/editable only if the current user is a member of that
-- row's workspace. The app identifies the user with a transaction-local
-- session variable it sets per request/transaction:
--
--   select set_config('app.user_id', '<session user uuid>', true);
--
-- With the variable unset, `current_setting('app.user_id', true)` returns
-- null and no rows match.
--
-- Caveat: RLS does not apply to the table owner / superuser. The compose
-- stack connects as `postgres`, which bypasses RLS — fine for
-- single-workspace self-host, but the SaaS must connect as a non-owner role
-- (see "specboard_app role" in docs/PLAN-fly-better-auth.md, still open).

create or replace function specboard_is_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from members m
    where m.workspace_id = target_workspace
      and m.user_id = nullif(current_setting('app.user_id', true), '')::uuid
  );
$$;
--> statement-breakpoint

-- Enable RLS + membership policy on each tenant-scoped table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'workspaces', 'members', 'repositories', 'features', 'comments', 'activity_log'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
--> statement-breakpoint

-- workspaces: members can see their own workspace row.
create policy workspaces_member_select on workspaces
  for select using (specboard_is_member(id));
--> statement-breakpoint

-- Tenant tables that carry workspace_id directly.
create policy features_member_all on features
  for all using (specboard_is_member(workspace_id))
  with check (specboard_is_member(workspace_id));
--> statement-breakpoint

create policy repositories_member_all on repositories
  for all using (specboard_is_member(workspace_id))
  with check (specboard_is_member(workspace_id));
--> statement-breakpoint

create policy comments_member_all on comments
  for all using (specboard_is_member(workspace_id))
  with check (specboard_is_member(workspace_id));
--> statement-breakpoint

create policy activity_member_all on activity_log
  for all using (specboard_is_member(workspace_id))
  with check (specboard_is_member(workspace_id));
--> statement-breakpoint

create policy members_member_select on members
  for select using (specboard_is_member(workspace_id));
--> statement-breakpoint

-- spec_index has no workspace_id column; join through its feature.
alter table spec_index enable row level security;
--> statement-breakpoint
create policy spec_index_member_all on spec_index
  for all using (
    exists (
      select 1 from features f
      where f.id = spec_index.feature_id
        and specboard_is_member(f.workspace_id)
    )
  );
