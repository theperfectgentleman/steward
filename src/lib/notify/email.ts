import {
  buildTransactionalEmail,
  emailButton,
  emailCodeBlock,
} from "@/lib/notify/email-layout";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  toName?: string;
  /** Brevo category tag for transactional analytics */
  tag?: string;
};

type Sender = { name: string; email: string; replyTo?: string };

function brevoApiKey(): string | undefined {
  return process.env.BREVO_API_KEY?.trim() || process.env.SENDINBLUE_API_KEY?.trim();
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.BREVO_SMTP_HOST?.trim() &&
      process.env.BREVO_USER?.trim() &&
      process.env.BREVO_PASSWORD?.trim() &&
      process.env.BREVO_FROM_EMAIL?.trim(),
  );
}

/** Parse `Steward <noreply@example.com>` or plain address. */
function parseEmailFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: "Steward", email: raw.trim() };
}

function resolveSender(): Sender {
  if (process.env.BREVO_FROM_EMAIL?.trim()) {
    return {
      name: process.env.BREVO_FROM_NAME?.trim() || "Steward",
      email: process.env.BREVO_FROM_EMAIL.trim(),
      replyTo: process.env.BREVO_REPLY_TO?.trim() || undefined,
    };
  }

  const from = parseEmailFrom(
    process.env.EMAIL_FROM ?? "Steward <noreply@example.com>",
  );
  return { ...from, replyTo: process.env.BREVO_REPLY_TO?.trim() || undefined };
}

async function sendViaBrevoApi(
  payload: EmailPayload,
  sender: Sender,
  apiKey: string,
): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      replyTo: sender.replyTo ? { email: sender.replyTo } : undefined,
      to: [{ email: payload.to, name: payload.toName ?? payload.to }],
      subject: payload.subject,
      textContent: payload.text,
      htmlContent: payload.html ?? payload.text.replace(/\n/g, "<br>"),
      tags: payload.tag ? [payload.tag] : ["transactional"],
      headers: {
        "X-Entity-Ref-ID": payload.tag ?? "transactional",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed: ${body}`);
  }
}

async function sendViaBrevoSmtp(
  payload: EmailPayload,
  sender: Sender,
): Promise<void> {
  const nodemailer = await import("nodemailer");
  const host = process.env.BREVO_SMTP_HOST!;
  const auth = {
    user: process.env.BREVO_USER!,
    pass: process.env.BREVO_PASSWORD!,
  };
  const base = {
    host,
    auth,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
  };

  const ports = [
    Number(process.env.BREVO_SMTP_PORT ?? 587),
    465,
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  const mail = {
    from: `"${sender.name}" <${sender.email}>`,
    replyTo: sender.replyTo,
    to: payload.toName ? `"${payload.toName}" <${payload.to}>` : payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? payload.text.replace(/\n/g, "<br>"),
    headers: {
      "X-Entity-Ref-ID": payload.tag ?? "transactional",
      "X-Auto-Response-Suppress": "OOF, AutoReply",
    },
  };

  let lastError: unknown;
  for (const port of ports) {
    const transporter = nodemailer.createTransport({
      ...base,
      port,
      secure: port === 465,
    });
    try {
      const info = await transporter.sendMail(mail);
      if (process.env.NODE_ENV !== "production") {
        console.info("[email:sent]", {
          to: payload.to,
          subject: payload.subject,
          messageId: info.messageId,
          response: info.response,
        });
      }
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[email:smtp] port ${port} failed:`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Brevo SMTP send failed on all ports");
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = brevoApiKey();
  const sender = resolveSender();

  if (!apiKey && !smtpConfigured()) {
    console.info("[email:dev]", {
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return;
  }

  if (apiKey) {
    await sendViaBrevoApi(payload, sender, apiKey);
    return;
  }

  await sendViaBrevoSmtp(payload, sender);
}

export async function sendInviteEmail(params: {
  to: string;
  name: string;
  committeeName: string;
  inviteUrl: string;
}) {
  const { html, text } = buildTransactionalEmail({
    preview: `Invitation to join ${params.committeeName}`,
    greeting: `Hi ${params.name},`,
    bodyHtml: `<p style="margin:0 0 12px;">You've been invited to join <strong>${params.committeeName}</strong> on Steward.</p>
${emailButton(params.inviteUrl, "Accept invitation")}
<p style="margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#52525b;">This link expires in 7 days.</p>`,
    footerNote: `Sent by Steward for ${params.committeeName}. If you weren't expecting this, you can ignore this email.`,
  });

  await sendEmail({
    to: params.to,
    toName: params.name,
    subject: `Invitation to ${params.committeeName} on Steward`,
    text,
    html,
    tag: "invite",
  });
}

export async function sendOtpEmail(params: {
  to: string;
  name: string;
  code: string;
}) {
  const { html, text } = buildTransactionalEmail({
    preview: "Your Steward sign-in code",
    greeting: `Hi ${params.name},`,
    bodyHtml: `<p style="margin:0 0 8px;">Use this code to sign in to Steward:</p>
${emailCodeBlock(params.code)}
<p style="margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#52525b;">It expires in 10 minutes. Never share this code with anyone.</p>`,
    footerNote:
      "If you didn't try to sign in, you can ignore this email. No account changes were made.",
  });

  await sendEmail({
    to: params.to,
    toName: params.name,
    subject: "Your Steward sign-in code",
    text,
    html,
    tag: "otp",
  });
}

export async function sendAddedToCommitteeEmail(params: {
  to: string;
  name: string;
  committeeName: string;
  loginUrl: string;
}) {
  const { html, text } = buildTransactionalEmail({
    preview: `You've been added to ${params.committeeName}`,
    greeting: `Hi ${params.name},`,
    bodyHtml: `<p style="margin:0 0 12px;">You've been added to <strong>${params.committeeName}</strong> on Steward.</p>
${emailButton(params.loginUrl, "Open Steward")}`,
    footerNote: `Sent by Steward for ${params.committeeName}.`,
  });

  await sendEmail({
    to: params.to,
    toName: params.name,
    subject: `You're now on ${params.committeeName} in Steward`,
    text,
    html,
    tag: "committee-added",
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(brevoApiKey() || smtpConfigured());
}
