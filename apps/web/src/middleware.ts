import { NextResponse, type NextRequest } from "next/server";

/**
 * Injects the active org slug (the first path segment) as the `x-org-slug`
 * request header so server code can resolve the tenant without threading
 * `params.org` through every page (ADR 0001, D3). Authority still comes from a
 * validated membership in `requireWorkspaceAccess` — this header is only a hint.
 */
export function middleware(req: NextRequest) {
  const slug = req.nextUrl.pathname.split("/")[1] ?? "";
  const headers = new Headers(req.headers);
  headers.set("x-org-slug", slug);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on app routes; skip Next internals, static assets, and the API surface
  // (API routes resolve their own scope).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
