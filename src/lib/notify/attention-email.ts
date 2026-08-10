import type { AttentionItem } from "@/lib/attention";
import { buildTransactionalEmail } from "@/lib/notify/email-layout";
import { sendEmail, isEmailConfigured } from "@/lib/notify/email";
import { prisma } from "@/lib/prisma";

const DIGEST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

function digestItemsHtml(items: AttentionItem[]): string {
  const rows = items
    .slice(0, 12)
    .map(
      (item) =>
        `<li style="margin:0 0 10px;"><a href="${item.href}" style="color:#18181b;font-weight:600;text-decoration:none;">${item.title}</a><br><span style="font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#71717a;">${item.subtitle}</span></li>`,
    )
    .join("");
  const more =
    items.length > 12
      ? `<p style="margin:12px 0 0;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#71717a;">+ ${items.length - 12} more in Steward</p>`
      : "";
  return `<ul style="margin:0;padding:0 0 0 18px;">${rows}</ul>${more}`;
}

export async function maybeSendAttentionDigest(params: {
  userId: string;
  email: string;
  name: string;
  emailAttentionEnabled: boolean;
  lastAttentionEmailAt: Date | null;
  items: AttentionItem[];
  appBaseUrl?: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  if (!params.emailAttentionEnabled) return false;

  const actionable = params.items.filter((i) => i.urgency === "NOW");
  if (actionable.length === 0) return false;

  const last = params.lastAttentionEmailAt?.getTime() ?? 0;
  if (Date.now() - last < DIGEST_COOLDOWN_MS) return false;

  const base = (params.appBaseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(
    /\/$/,
    "",
  );
  const inboxHref = base ? `${base}/` : "/";

  const lines = actionable.map((i) => `• ${i.title} — ${i.subtitle}`).join("\n");
  const { html, text } = buildTransactionalEmail({
    preview: `${actionable.length} item(s) need your attention`,
    greeting: `Hi ${params.name},`,
    bodyHtml: `<p style="margin:0 0 12px;">You have <strong>${actionable.length}</strong> item(s) waiting in Steward:</p>
${digestItemsHtml(actionable)}
<p style="margin:16px 0 0;"><a href="${inboxHref}" style="color:#18181b;font-weight:600;">Open Steward</a></p>`,
    footerNote:
      "You're receiving this because email notifications are enabled on your Steward account. Turn them off in the inbox panel.",
  });

  await sendEmail({
    to: params.email,
    toName: params.name,
    subject:
      actionable.length === 1
        ? `Action needed: ${actionable[0].title}`
        : `${actionable.length} items need your attention in Steward`,
    text,
    html,
    tag: "attention-digest",
  });

  await prisma.user.update({
    where: { id: params.userId },
    data: { lastAttentionEmailAt: new Date() },
  });

  return true;
}
