import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { isBlockedEmailDomain } from "@specboard/core";
import { createDb, schema } from "@specboard/db";

/**
 * Reject sign-ups from consumer email providers (gmail.com, outlook.com, …)
 * when `SPECBOARD_BLOCK_PUBLIC_EMAIL_DOMAINS` is truthy. On for the hosted
 * SaaS; off by default so self-host admins can test with personal addresses.
 */
function blockPublicEmailDomains(): boolean {
  const value = process.env.SPECBOARD_BLOCK_PUBLIC_EMAIL_DOMAINS?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function createAuth(url: string) {
  return betterAuth({
    database: drizzleAdapter(createDb(url), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: { enabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email" || !blockPublicEmailDomains()) return;
        const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
        if (isBlockedEmailDomain(email)) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Please sign up with your work email address. Personal email providers are not supported on the hosted service.",
          });
        }
      }),
    },
    advanced: {
      // Postgres mints UUID ids (see schema) instead of Better Auth's
      // default text ids.
      database: { generateId: false },
    },
  });
}

let auth: ReturnType<typeof createAuth> | null | undefined;

/**
 * Better Auth server instance, resolved once per process. Mirrors the
 * `getStore()` pattern: gated on `DATABASE_URL`, `null` in local file mode.
 */
export function getAuth() {
  if (auth === undefined) {
    const url = process.env.DATABASE_URL;
    auth = url ? createAuth(url) : null;
  }
  return auth;
}
