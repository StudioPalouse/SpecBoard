-- Custom SQL migration file, put your code below! --

-- ADR 0002: introduce a spec-backed "Work Item" leaf beneath "Feature".
--
-- For every workspace whose hierarchy still uses the default leaf "feature":
--   1. add a "work" leaf level and demote "feature" to a grouping level;
--   2. move each spec row (repo-backed) down to "work", wrapping it 1:1 in a
--      new app-native Feature grouping that inherits the spec's former parent.
--
-- Workspaces that customized their leaf (key != 'feature') are left untouched.
-- The FOR-over-SELECT cursors snapshot their result sets, so rows updated mid
-- loop are not re-processed; wrapper rows (repo_id IS NULL) are never selected.
DO $$
DECLARE
  ws RECORD;
  feat_pos INTEGER;
  spec RECORD;
  wrapper_id UUID;
BEGIN
  FOR ws IN
    SELECT workspace_id, position AS pos
    FROM workspace_levels
    WHERE key = 'feature' AND is_leaf = true
  LOOP
    feat_pos := ws.pos;

    -- 1. Add the new spec-backed leaf; demote "feature" to a grouping.
    IF NOT EXISTS (
      SELECT 1 FROM workspace_levels
      WHERE workspace_id = ws.workspace_id AND key = 'work'
    ) THEN
      INSERT INTO workspace_levels (workspace_id, key, label, position, is_leaf)
      VALUES (ws.workspace_id, 'work', 'Work Item', feat_pos + 1, true);
    END IF;

    UPDATE workspace_levels
    SET is_leaf = false
    WHERE workspace_id = ws.workspace_id AND key = 'feature';

    -- 2. Wrap each existing spec (1:1) in a Feature grouping, then move the
    --    spec down to the work leaf under that wrapper.
    FOR spec IN
      SELECT id, product_id, title, status, rank, parent_id
      FROM features
      WHERE workspace_id = ws.workspace_id
        AND repo_id IS NOT NULL
        AND level = 'feature'
    LOOP
      wrapper_id := gen_random_uuid();
      INSERT INTO features (
        id, spec_id, workspace_id, repo_id, product_id, level,
        title, status, rank, parent_id
      )
      VALUES (
        wrapper_id, wrapper_id, ws.workspace_id, NULL, spec.product_id, 'feature',
        spec.title, spec.status, spec.rank, spec.parent_id
      );

      UPDATE features
      SET level = 'work', parent_id = wrapper_id
      WHERE id = spec.id;
    END LOOP;
  END LOOP;
END $$;