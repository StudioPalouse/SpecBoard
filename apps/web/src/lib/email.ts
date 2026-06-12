/**
 * Outbound email via Postmark (https://postmarkapp.com).
 *
 * Configured entirely by env so self-host works without it:
 * - `POSTMARK_SERVER_TOKEN` — server API token; unset = email disabled,
 *   sends become logged no-ops (sign-up still works, verification links
 *   are just never delivered).
 * - `EMAIL_FROM` — verified sender signature / domain address,
 *   e.g. `SpecBoard <no-reply@specboard.ai>`.
 *
 * Uses Postmark's HTTP API directly — no SDK dependency.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export async function sendEmail(message: OutboundEmail): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.EMAIL_FROM;
  if (!token || !from) {
    console.warn(
      `[email] POSTMARK_SERVER_TOKEN/EMAIL_FROM not set; dropping "${message.subject}" to ${message.to}`,
    );
    return;
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-postmark-server-token": token,
    },
    body: JSON.stringify({
      From: from,
      To: message.to,
      Subject: message.subject,
      TextBody: message.textBody,
      HtmlBody: message.htmlBody,
      MessageStream: "outbound",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Postmark send failed (${res.status}): ${detail}`);
  }
}
