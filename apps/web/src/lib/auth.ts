import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { isBlockedEmailDomain } from "@specboard/core";
import { createDb, schema } from "@specboard/db";

import { renderActionEmail, sendEmail } from "@/lib/email";

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
    emailAndPassword: {
      enabled: true,
      // Block sign-in until the address is confirmed. Combined with
      // `sendOnSignUp` below this closes the gap where a fresh deployment's
      // first-user admin slot could be claimed without mailbox control.
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        const { textBody, htmlBody } = renderActionEmail({
          name: user.name,
          intro: "We received a request to reset your SpecBoard password. Click the button below to choose a new one.",
          action: "Reset password",
          url,
          footer: "If you didn't request this, you can safely ignore this email.",
        });
        await sendEmail({
          to: user.email,
          subject: "Reset your SpecBoard password",
          textBody,
          htmlBody,
        });
      },
    },
    user: {
      // Extra profile columns beyond Better Auth's defaults. `timezone` is the
      // user's IANA zone, edited on Settings → Profile (kept in sync with the
      // client's inferAdditionalFields in auth-client.ts and the users schema).
      additionalFields: {
        timezone: { type: "string", required: false, input: true },
      },
      // Let users change their email from the account page. Because their
      // current address is verified, Better Auth sends a confirmation link to
      // the *existing* inbox; the change only takes effect once that's clicked.
      changeEmail: {
        enabled: true,
        sendChangeEmailVerification: async ({
          user,
          newEmail,
          url,
        }: {
          user: { name: string; email: string };
          newEmail: string;
          url: string;
        }) => {
          const { textBody, htmlBody } = renderActionEmail({
            name: user.name,
            intro: `Confirm that you want to change your SpecBoard email address to ${newEmail}. The change takes effect once you click the button below.`,
            action: "Confirm email change",
            url,
            footer: "If you didn't request this, you can safely ignore this email and your address stays the same.",
          });
          await sendEmail({
            to: user.email,
            subject: "Confirm your SpecBoard email change",
            textBody,
            htmlBody,
          });
        },
      },
    },
    emailVerification: {
      // Delivered via Postmark when POSTMARK_SERVER_TOKEN is set. Sign-in is
      // gated on verification (see requireEmailVerification above); a failed
      // sign-in by an unverified user re-sends this email automatically.
      sendOnSignUp: true,
      // Land verified users back in the app rather than on a bare API 200.
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const { textBody, htmlBody } = renderActionEmail({
          name: user.name,
          intro: "Confirm your email address to finish setting up your SpecBoard account.",
          action: "Verify email",
          url,
        });
        await sendEmail({
          to: user.email,
          subject: "Verify your SpecBoard email",
          textBody,
          htmlBody,
        });
      },
    },
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
