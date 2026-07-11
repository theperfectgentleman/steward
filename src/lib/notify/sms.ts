type SmsPayload = {
  to: string;
  body: string;
};

export async function sendSms(payload: SmsPayload): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.info("[sms:dev]", payload);
    return;
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({
    To: payload.to,
    From: from,
    Body: payload.body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SMS send failed: ${text}`);
  }
}

export async function sendInviteSms(params: {
  to: string;
  committeeName: string;
  inviteUrl: string;
}) {
  await sendSms({
    to: params.to,
    body: `You're invited to ${params.committeeName} on Steward. Get started: ${params.inviteUrl}`,
  });
}

export async function sendOtpSms(params: { to: string; code: string }) {
  await sendSms({
    to: params.to,
    body: `Your Steward verification code is ${params.code}. It expires in 10 minutes.`,
  });
}

export async function sendAddedToCommitteeSms(params: {
  to: string;
  committeeName: string;
  loginUrl: string;
}) {
  await sendSms({
    to: params.to,
    body: `You've been added to ${params.committeeName} on Steward. Sign in: ${params.loginUrl}`,
  });
}
