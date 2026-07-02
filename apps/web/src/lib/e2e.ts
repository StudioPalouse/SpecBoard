/**
 * E2E test-mode flag. Set to a truthy value (`SPECBOARD_E2E=1`) only by the
 * Playwright harness; never present in the deployed test/prod environments. When
 * on, a few narrow seams relax production gates so tests can run hermetically:
 *   - auth drops the email-verification requirement (see `auth.ts`), and
 *   - the GitHub App is treated as configured with an in-memory fake repo client
 *     (see `github-e2e.ts` / `github-sync.ts`).
 * With the flag off, every one of those paths behaves exactly as in production.
 */
export function isE2E(): boolean {
  // Belt and suspenders: never honor the E2E flag in a production build, so a
  // stray or injected SPECBOARD_E2E can't disable email verification or swap in
  // the fake GitHub client on a deployed environment. The Playwright harness
  // runs with NODE_ENV !== "production".
  if (process.env.NODE_ENV === "production") return false;
  const value = process.env.SPECBOARD_E2E?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Path to the JSON file backing the fake GitHub repo contents in E2E runs. The
 * Playwright harness seeds it before a test and the fake reads/writes it so a
 * committed starter spec is visible to a later scan. Defaults to a file in the
 * OS temp dir when unset.
 */
export function e2eGithubFixturePath(): string {
  return process.env.SPECBOARD_E2E_GITHUB_FIXTURE?.trim() || "/tmp/specboard-e2e-github.json";
}
