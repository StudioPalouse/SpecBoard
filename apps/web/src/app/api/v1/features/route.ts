import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/features — list all features (spec identity + PM metadata). */
export async function GET() {
  const store = await getStore();
  const features = await store.listFeatures();
  return Response.json({ features });
}
