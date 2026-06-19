/**
 * Single- vs multi-tenant mode.
 *
 * The app is *always* multi-tenant internally — the active org is resolved and
 * validated against the caller's memberships on every request (see
 * `resolveActiveWorkspace`). This flag only governs whether one deployment
 * serves many orgs (hosted) or exactly one (self-host).
 *
 * Default is **single-tenant** so the OSS / self-host path is the simple one;
 * hosted opts in with `SPECBOARD_MULTI_TENANT=true`. Single-tenant is just the
 * N=1 case of the same code path — never a fork.
 *
 * See docs/adr/0001-multi-tenancy-url-and-product-grouping.md (D1).
 */
export function isMultiTenant(): boolean {
  return process.env.SPECBOARD_MULTI_TENANT === "true";
}

/** Convenience inverse of {@link isMultiTenant}. */
export function isSingleTenant(): boolean {
  return !isMultiTenant();
}
