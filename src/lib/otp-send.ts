import { prisma } from "@/lib/prisma";
import { maskEmail, maskPhone } from "@/lib/identity";
import { sendOtpEmail } from "@/lib/notify/email";
import { sendOtpSms } from "@/lib/notify/sms";
import {
  generateOtpCode,
  hashOtp,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/otp";

export class OtpSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function issueOtpChallenge(input: {
  userId: string;
  channel: "EMAIL" | "SMS";
  purpose: "INVITE" | "LOGIN_RESET";
}): Promise<{ maskedDestination: string }> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new OtpSendError("User not found", 404);
  }

  const recent = await prisma.otpChallenge.findFirst({
    where: {
      userId: user.id,
      purpose: input.purpose,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recent) {
    throw new OtpSendError(
      "Please wait a minute before requesting another code",
      429,
    );
  }

  const destination =
    input.channel === "EMAIL" ? user.email : user.phone;

  if (!destination) {
    throw new OtpSendError(
      input.channel === "SMS" ? "No phone on file" : "No email on file",
      400,
    );
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code);

  await prisma.otpChallenge.create({
    data: {
      userId: user.id,
      channel: input.channel,
      destination,
      codeHash,
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  if (input.channel === "EMAIL") {
    await sendOtpEmail({ to: destination, name: user.name, code });
  } else {
    await sendOtpSms({ to: destination, code });
  }

  return {
    maskedDestination:
      input.channel === "EMAIL"
        ? maskEmail(destination)
        : maskPhone(destination),
  };
}
