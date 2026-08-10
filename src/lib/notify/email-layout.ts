type TransactionalEmail = {
  preview: string;
  greeting: string;
  bodyHtml: string;
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain transactional layout — avoids spammy bare `<br>` dumps. */
export function buildTransactionalEmail(input: TransactionalEmail): {
  html: string;
  text: string;
} {
  const preview = escapeHtml(input.preview);
  const greeting = escapeHtml(input.greeting);
  const footer = escapeHtml(
    input.footerNote ??
      "You received this because someone used Steward with your email address.",
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${preview}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
          <tr>
            <td style="padding:28px 28px 8px;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
              <p style="margin:0 0 16px;">${greeting}</p>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#71717a;border-top:1px solid #f4f4f5;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    input.greeting.replace(/<\/?[^>]+>/g, ""),
    input.bodyHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim(),
    "",
    footer,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function emailButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<p style="margin:20px 0;">
  <a href="${safeHref}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:12px 18px;border-radius:8px;">${safeLabel}</a>
</p>
<p style="margin:0 0 12px;font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#52525b;word-break:break-all;">
  Or copy this link:<br>${safeHref}
</p>`;
}

export function emailCodeBlock(code: string): string {
  const safeCode = escapeHtml(code);
  return `<p style="margin:16px 0;font:700 28px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0.2em;color:#18181b;">${safeCode}</p>`;
}
