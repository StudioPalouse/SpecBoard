import { cookies } from "next/headers";

import { repositories } from "@specboard/db";
import {
  createInstallationOrgRepository,
  getInstallationAccount,
} from "@specboard/git";

import { getSessionUser } from "@/lib/auth-session";
import { getDb } from "@/lib/db";
import { getGithubApp } from "@/lib/github-app";
import { loadPendingInstallation } from "@/lib/github-connect";
import { INSTALL_COOKIE, readInstallCookie } from "@/lib/github-install";
import { getMembership } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/github/installations/repositories — the repos the admin's pending
 * installation can access, for the connect picker. The installation id comes
 * from the signed cookie set by the setup callback (not the client), so this
 * can only list installations the caller actually performed.
 */
export async function GET(req: Request) {
  const db = getDb();
  const user = await getSessionUser(req);
  if (!db || !user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const membership = await getMembership(db, user.id);
  if (!membership || membership.role !== "admin") {
    return Response.json({ error: "Only an admin can connect repositories." }, { status: 403 });
  }

  const pending = await loadPendingInstallation(db, user.id);
  if (pending.error) {
    // A pending id with a failed list is a GitHub-side failure (502); an error
    // without one means the App isn't configured at all (501).
    return Response.json(
      { error: pending.error },
      { status: pending.installationId ? 502 : 501 },
    );
  }
  return Response.json({
    installationId: pending.installationId,
    repositories: pending.repositories,
  });
}

/** GitHub repository names: word characters, dots, and hyphens. */
const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Turn a failed create-repo call into a message the admin can act on. */
function createRepoErrorMessage(err: unknown, name: string, org: string): string {
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : null;
  if (status === 422) {
    return `GitHub rejected the repository (a repo called "${name}" may already exist in ${org}).`;
  }
  if (status === 403 || status === 404) {
    return (
      "The Specboard GitHub App isn't allowed to create repositories yet. " +
      "Approve its updated permissions (repository Administration) on GitHub, then try again."
    );
  }
  return "GitHub couldn't create the repository. Please try again.";
}

/**
 * POST /api/v1/github/installations/repositories: create a private spec repo
 * in the pending installation's organization and connect it to the workspace.
 * One-click alternative to the "create a repo on GitHub, install the App,
 * connect it here" instructions. Admin-only; the installation id comes from
 * the signed cookie, same trust model as GET. Body: { name }.
 *
 * Only works for organization installations: GitHub has no installation-token
 * endpoint that creates repos under a personal account, so those users keep
 * the manual flow.
 */
export async function POST(req: Request) {
  const db = getDb();
  const user = await getSessionUser(req);
  if (!db || !user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const membership = await getMembership(db, user.id);
  if (!membership || membership.role !== "admin") {
    return Response.json({ error: "Only an admin can create repositories." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!REPO_NAME_RE.test(name) || name === "." || name === "..") {
    return Response.json(
      { error: "Repository names can use letters, numbers, dots, hyphens, and underscores." },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const installationId = readInstallCookie(user.id, jar.get(INSTALL_COOKIE)?.value);
  if (!installationId) {
    return Response.json(
      { error: "Connect GitHub first, then come back here to create the repo." },
      { status: 403 },
    );
  }

  const app = await getGithubApp(db);
  if (!app) {
    return Response.json({ error: "GitHub App is not configured." }, { status: 501 });
  }

  let account;
  try {
    account = await getInstallationAccount(app, installationId);
  } catch (err) {
    console.error("[github] failed to resolve installation account:", err);
    return Response.json(
      { error: "Couldn't look up the GitHub installation. Please try again." },
      { status: 502 },
    );
  }
  if (account.type !== "Organization") {
    return Response.json(
      {
        error:
          "GitHub only lets the App create repositories in an organization. " +
          "For a personal account, create the repo on GitHub and install the App on it.",
      },
      { status: 400 },
    );
  }

  let created;
  try {
    created = await createInstallationOrgRepository(app, installationId, {
      org: account.login,
      name,
      description: "Product specs synced to Specboard",
    });
  } catch (err) {
    console.error(`[github] failed to create repository ${account.login}/${name}:`, err);
    return Response.json(
      { error: createRepoErrorMessage(err, name, account.login) },
      { status: 502 },
    );
  }

  // Register it as a connected repo, same shape as the connect flow. Upsert so
  // retrying after a partial failure converges instead of erroring.
  const [repo] = await db
    .insert(repositories)
    .values({
      workspaceId: membership.workspaceId,
      githubInstallationId: installationId,
      owner: created.owner,
      name: created.name,
      defaultBranch: created.defaultBranch,
    })
    .onConflictDoUpdate({
      target: [repositories.workspaceId, repositories.owner, repositories.name],
      set: {
        githubInstallationId: installationId,
        defaultBranch: created.defaultBranch,
      },
    })
    .returning();
  if (!repo) {
    return Response.json(
      { error: `Created ${created.owner}/${created.name} on GitHub but couldn't connect it. Connect it from the picker above.` },
      { status: 500 },
    );
  }

  return Response.json(
    {
      repository: {
        id: repo.id,
        owner: created.owner,
        name: created.name,
        defaultBranch: created.defaultBranch,
        htmlUrl: created.htmlUrl,
      },
    },
    { status: 201 },
  );
}
