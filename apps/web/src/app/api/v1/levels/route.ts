import { resolveReadScope } from "@/lib/auth-session";
import { listLevels } from "@/lib/features-service";

export const dynamic = "force-dynamic";

/** GET /api/v1/levels — the caller workspace's hierarchy levels (top → leaf). */
export async function GET(req: Request) {
  const authz = await resolveReadScope(req);
  if (!authz.ok) return authz.response;

  const levels = await listLevels(authz.scope ?? undefined);
  return Response.json({ levels });
}
