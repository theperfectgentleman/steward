type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Steward <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[email:dev]", {
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? payload.text.replace(/\n/g, "<br>"),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed: ${body}`);
  }
}

export async function sendInviteEmail(params: {
  to: string;
  name: string;
  committeeName: string;
  inviteUrl: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `You're invited to ${params.committeeName} on Steward`,
    text: `Hi ${params.name},\n\nYou've been invited to join ${params.committeeName} on Steward.\n\nOpen this link to get started:\n${params.inviteUrl}\n\nThis link expires in 7 days.`,
  });
}

export async function sendOtpEmail(params: {
  to: string;
  name: string;
  code: string;
}) {
  await sendEmail({
    to: params.to,
    subject: "Your Steward verification code",
    text: `Hi ${params.name},\n\nYour verification code is ${params.code}.\n\nIt expires in 10 minutes.`,
  });
}

export async function sendAddedToCommitteeEmail(params: {
  to: string;
  name: string;
  committeeName: string;
  loginUrl: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `You've been added to ${params.committeeName}`,
    text: `Hi ${params.name},\n\nYou've been added to ${params.committeeName} on Steward.\n\nSign in here:\n${params.loginUrl}`,
  });
}
