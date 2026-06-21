import { and, eq, repositories } from "@specboard/db";

import { authorizeOrgAdmin } from "@/lib/auth-session";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/repositories/:id — disconnect a connected repo. Admin-only,
 * mirroring connect (connecting wires automated commits into a source tree, so
 * disconnecting is the same blast radius). Detaches imported board items
 * (`features.repo_id` → NULL via the FK) and removes the repo's GitHub links;
 * the board content itself is preserved as standalone rows.
 */
export async function DELETE(req: Request, { params }: Params) {
  const authz = await authorizeOrgAdmin(req);
  if (!authz.ok) return authz.response;

  const db = getDb();
  // Local file mode (auth disabled → null scope) has no repos to manage.
  if (!db || !authz.scope) {
    return Response.json(
      { error: "Repository management requires a database." },
      { status: 501 },
    );
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(repositories)
    .where(and(eq(repositories.id, id), eq(repositories.workspaceId, authz.scope.workspaceId)))
    .returning();
  if (!deleted) {
    return Response.json({ error: "Repository not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
