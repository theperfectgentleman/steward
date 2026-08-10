import "dotenv/config";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { buildTransactionalEmail, emailButton } from "../src/lib/notify/email-layout";

async function main() {
  const host = process.env.BREVO_SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT ?? 587);
  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_PASSWORD;
  const from = process.env.BREVO_FROM_EMAIL;
  const to =
    process.env.BREVO_TEST_TO?.trim() ||
    process.env.BREVO_REPLY_TO?.trim() ||
    from;

  console.log("Config check:", {
    host: host ? "set" : "MISSING",
    port,
    user: user ? `${user.slice(0, 12)}…` : "MISSING",
    pass: pass ? `set (${pass.length} chars)` : "MISSING",
    from,
    to,
  });

  if (!host || !user || !pass || !from || !to) {
    console.error("Missing required Brevo SMTP env vars");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });

  // Also probe 465 if 587 fails (some networks block 587)
  async function tryVerify(label: string, cfg: SMTPTransport.Options) {
    const t = nodemailer.createTransport(cfg);
    await t.verify();
    console.log(`SMTP verify (${label}): OK`);
    return t;
  }

  let activeTransporter = transporter;
  try {
    await transporter.verify();
    console.log(`SMTP verify (port ${port}): OK`);
  } catch (err587) {
    console.error(`SMTP verify (port ${port}) FAILED:`, (err587 as Error).message);
    if (port !== 465) {
      try {
        activeTransporter = await tryVerify("port 465 SSL", {
          host,
          port: 465,
          secure: true,
          auth: { user, pass },
          connectionTimeout: 15000,
          greetingTimeout: 15000,
        });
      } catch (err465) {
        console.error("SMTP verify (port 465) FAILED:", (err465 as Error).message);
        console.error(
          "\nSMTP ports appear blocked from this network. Use BREVO_API_KEY (HTTPS) instead — see .env.example.",
        );
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  try {
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || "https://steward.example.com";
    const { html, text } = buildTransactionalEmail({
      preview: "Steward email deliverability test",
      greeting: "Hi there,",
      bodyHtml: `<p style="margin:0 0 12px;">This is a deliverability test from Steward at ${new Date().toISOString()}.</p>
${emailButton(loginUrl, "Open Steward")}`,
      footerNote:
        "If this landed in spam, authenticate cognatesystems.com in Brevo (SPF, DKIM, DMARC).",
    });

    const info = await activeTransporter.sendMail({
      from: `"${process.env.BREVO_FROM_NAME || "Steward"}" <${from}>`,
      replyTo: process.env.BREVO_REPLY_TO,
      to,
      subject: "Steward deliverability test",
      text,
      html,
      headers: {
        "X-Auto-Response-Suppress": "OOF, AutoReply",
      },
    });
    console.log("sendMail accepted by SMTP server:");
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.error("sendMail FAILED:", err);
    process.exit(1);
  }

  // If REST API key exists, check account + recent transactional stats
  const apiKey =
    process.env.BREVO_API_KEY?.trim() ||
    process.env.SENDINBLUE_API_KEY?.trim();
  if (apiKey) {
    const acct = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    console.log("Brevo account API:", acct.status, await acct.text());
  } else {
    console.log(
      "Tip: add BREVO_API_KEY (xkeysib-…) to inspect delivery events in Brevo dashboard via API.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
