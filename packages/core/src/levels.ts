/**
 * Work-tracking hierarchy levels. A workspace chooses its depth — e.g.
 * Initiative → Epic → Feature — where the deepest (leaf) level is the
 * git-backed spec and the higher levels are DB-native grouping records.
 * Levels are persisted per workspace (`workspace_levels`); this module is the
 * framework-agnostic shape + the rules relating a child's level to its parent.
 */

export interface WorkspaceLevel {
  /** Stable identifier stored on `features.level` (e.g. "epic"). */
  key: string;
  /** Human label shown in the UI (e.g. "Epic"). */
  label: string;
  /** Depth, ascending: 0 is the top level; the largest is the leaf. */
  position: number;
  /** The single spec-backed leaf level. Higher levels are DB-native. */
  isLeaf: boolean;
}

/** Default three-level hierarchy seeded for every new workspace. */
export const DEFAULT_LEVELS: readonly WorkspaceLevel[] = [
  { key: "initiative", label: "Initiative", position: 0, isLeaf: false },
  { key: "epic", label: "Epic", position: 1, isLeaf: false },
  { key: "feature", label: "Feature", position: 2, isLeaf: true },
];

/**
 * The effective, ordered levels for a workspace: the configured set sorted by
 * position, or the default hierarchy when none is configured. Guarantees a
 * non-empty list with exactly one leaf (the deepest level if none is flagged).
 */
export function resolveLevels(
  levels?: readonly WorkspaceLevel[] | null,
): WorkspaceLevel[] {
  const source =
    levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
  const sorted = [...source].sort((a, b) => a.position - b.position);
  // Normalize the leaf flag: exactly the deepest level is the leaf.
  const leafIdx = sorted.length - 1;
  return sorted.map((l, i) => ({ ...l, isLeaf: i === leafIdx }));
}

/** The spec-backed leaf level (deepest). resolveLevels guarantees ≥1 level. */
export function leafLevel(levels?: readonly WorkspaceLevel[] | null): WorkspaceLevel {
  const resolved = resolveLevels(levels);
  const leaf = resolved.at(-1);
  if (!leaf) throw new Error("resolveLevels returned no levels");
  return leaf;
}

/** Whether `key` is the leaf (spec-backed) level. */
export function isLeafLevel(
  key: string,
  levels?: readonly WorkspaceLevel[] | null,
): boolean {
  return leafLevel(levels).key === key;
}

/** Look up a level by key, or undefined when it isn't part of the hierarchy. */
export function findLevel(
  key: string,
  levels?: readonly WorkspaceLevel[] | null,
): WorkspaceLevel | undefined {
  return resolveLevels(levels).find((l) => l.key === key);
}

/**
 * The key of the level immediately above `key` (the only valid parent level),
 * or null when `key` is the top level / unknown.
 */
export function parentLevelKey(
  key: string,
  levels?: readonly WorkspaceLevel[] | null,
): string | null {
  const resolved = resolveLevels(levels);
  const idx = resolved.findIndex((l) => l.key === key);
  if (idx <= 0) return null;
  return resolved[idx - 1]?.key ?? null;
}

/**
 * The key of the level immediately below `key` (the level its children take),
 * or null when `key` is the leaf / unknown.
 */
export function childLevelKey(
  key: string,
  levels?: readonly WorkspaceLevel[] | null,
): string | null {
  const resolved = resolveLevels(levels);
  const idx = resolved.findIndex((l) => l.key === key);
  if (idx < 0 || idx >= resolved.length - 1) return null;
  return resolved[idx + 1]?.key ?? null;
}

/**
 * Whether an item at `childKey` may sit under a parent at `parentKey`. A parent
 * is optional (orphans are allowed at any level), but when present it must be
 * exactly the level immediately above the child.
 */
export function isValidParentLevel(
  childKey: string,
  parentKey: string | null,
  levels?: readonly WorkspaceLevel[] | null,
): boolean {
  if (parentKey == null) return true;
  return parentLevelKey(childKey, levels) === parentKey;
}
