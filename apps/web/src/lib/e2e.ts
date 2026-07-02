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
  const value = process.env.SPECBOARD_E2E?.trim().toLowerCase();
  if (value !== "1" && value !== "true" && value !== "yes") return false;
  // Belt and suspenders: only honor the flag when the app is configured to
  // serve localhost, so a stray or injected SPECBOARD_E2E can't disable email
  // verification or swap in the fake GitHub client on a deployed environment
  // (which always serves a public origin). A NODE_ENV check would not work
  // here: the Playwright harness runs `next start`, which is a production
  // build.
  const origin = (process.env.APP_URL ?? process.env.BETTER_AUTH_URL)?.trim();
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
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
