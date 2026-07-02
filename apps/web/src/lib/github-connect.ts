import { cookies } from "next/headers";

import { listInstallationRepositories, type InstallationRepo } from "@specboard/git";
import type { Database } from "@specboard/db";

import { getGithubApp } from "@/lib/github-app";
import { INSTALL_COOKIE, readInstallCookie } from "@/lib/github-install";

/** The admin's pending App installation and the repos it can access. */
export interface PendingInstallation {
  installationId: string | null;
  repositories: InstallationRepo[];
  /** Set when the repo list couldn't be loaded (the id may still be valid). */
  error: string | null;
}

/** The common case: no install-flow cookie, nothing pending to connect. */
export const NO_PENDING_INSTALLATION: PendingInstallation = {
  installationId: null,
  repositories: [],
  error: null,
};

/**
 * Resolve the caller's pending installation (from the signed install cookie)
 * and list the repositories it can access. Shared by the API route and the
 * Repositories page: the page calls it server-side so the connect picker
 * renders with the initial HTML instead of popping in after a client fetch.
 * Without a pending cookie this returns immediately, no GitHub round-trip.
 */
export async function loadPendingInstallation(
  db: Database,
  userId: string,
): Promise<PendingInstallation> {
  const jar = await cookies();
  const installationId = readInstallCookie(userId, jar.get(INSTALL_COOKIE)?.value);
  if (!installationId) return NO_PENDING_INSTALLATION;

  const app = await getGithubApp(db);
  if (!app) {
    return { installationId: null, repositories: [], error: "GitHub App is not configured." };
  }

  try {
    return {
      installationId,
      repositories: await listInstallationRepositories(app, installationId),
      error: null,
    };
  } catch (err) {
    console.error("[github] failed to list installation repositories:", err);
    return {
      installationId,
      repositories: [],
      error: "Couldn't load repositories for this installation.",
    };
  }
}
