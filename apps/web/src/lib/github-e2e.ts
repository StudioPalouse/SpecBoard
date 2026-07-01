import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import type { GitRepoClient, SpecFile, WriteFileInput } from "@specboard/git";

import { e2eGithubFixturePath } from "@/lib/e2e";
import type { RepoRecord } from "@/lib/github-sync";

/**
 * In-memory (file-backed) fake of the GitHub repo client for E2E runs. It stands
 * in for `createGitHubRepoClient` when `SPECBOARD_E2E` is set, so the onboarding
 * flow (scan -> import -> starter spec) runs hermetically with no network and no
 * real GitHub App. Repo contents live in a JSON fixture the Playwright harness
 * seeds; writes (id injection, starter specs) persist back to that file so a
 * later scan in the same or a later request sees them.
 *
 * Fixture shape: `{ "owner/name": { "specs/foo/spec.md": "<raw>", ... }, ... }`.
 */
type Fixture = Record<string, Record<string, string>>;

function readFixture(): Fixture {
  try {
    return JSON.parse(readFileSync(e2eGithubFixturePath(), "utf8")) as Fixture;
  } catch {
    // Missing/empty fixture reads as "no repos have any files".
    return {};
  }
}

function writeFixture(data: Fixture): void {
  writeFileSync(e2eGithubFixturePath(), JSON.stringify(data, null, 2));
}

function blobShaOf(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

/** Convert a spec glob (supporting `*` and `**`) to an anchored RegExp. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const body = escaped
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${body}$`);
}

function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(path));
}

/** A fake `GitRepoClient` bound to one repo, reading/writing the shared fixture. */
export function fakeRepoClient(repo: Pick<RepoRecord, "owner" | "name">): GitRepoClient {
  const key = `${repo.owner}/${repo.name}`;

  return {
    async listSpecFiles(globs: string[]): Promise<SpecFile[]> {
      const files = readFixture()[key] ?? {};
      return Object.entries(files)
        .filter(([path]) => matchesAnyGlob(path, globs))
        .map(([path, raw]) => ({ path, raw, blobSha: blobShaOf(raw) }));
    },

    async readFile(path: string): Promise<SpecFile> {
      const raw = readFixture()[key]?.[path];
      if (raw === undefined) {
        throw new Error(`E2E fake: ${key} has no file at ${path}`);
      }
      return { path, raw, blobSha: blobShaOf(raw) };
    },

    async writeFile(input: WriteFileInput): Promise<{ commitSha: string; blobSha: string }> {
      const data = readFixture();
      const files = (data[key] ??= {});
      files[input.path] = input.content;
      writeFixture(data);
      return {
        commitSha: blobShaOf(`${input.path}\n${input.content}`),
        blobSha: blobShaOf(input.content),
      };
    },
  };
}
