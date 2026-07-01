import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Seed the fixture file that the app's fake GitHub client reads (see
 * apps/web/src/lib/github-e2e.ts). Tests set a repo's spec files here, then the
 * server's scan/import sees them. Same file path on both sides via
 * SPECBOARD_E2E_GITHUB_FIXTURE.
 */
type Fixture = Record<string, Record<string, string>>;

function fixturePath(): string {
  const path = process.env.SPECBOARD_E2E_GITHUB_FIXTURE;
  if (!path) throw new Error("SPECBOARD_E2E_GITHUB_FIXTURE must be set for E2E runs.");
  return path;
}

function read(): Fixture {
  try {
    return JSON.parse(readFileSync(fixturePath(), "utf8")) as Fixture;
  } catch {
    return {};
  }
}

function write(data: Fixture): void {
  mkdirSync(dirname(fixturePath()), { recursive: true });
  writeFileSync(fixturePath(), JSON.stringify(data, null, 2));
}

/** Reset all fake repo contents (call before each test for isolation). */
export function resetFixture(): void {
  write({});
}

/** Set the files (path -> raw content) the fake reports for one repo. */
export function setRepoFiles(owner: string, name: string, files: Record<string, string>): void {
  const data = read();
  data[`${owner}/${name}`] = files;
  write(data);
}

/** Read back a repo's files (e.g. to assert a starter spec was committed). */
export function getRepoFiles(owner: string, name: string): Record<string, string> {
  return read()[`${owner}/${name}`] ?? {};
}

/** A minimal spec.md body with a stable id (so import skips id injection). */
export function specMd(title: string, id: string): string {
  return `---\nid: ${id}\ntitle: ${JSON.stringify(title)}\nkind: feature\n---\n\n# ${title}\n\nBody.\n`;
}
