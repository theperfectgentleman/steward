"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { FORM_FIELD_CLASS } from "@/lib/form-field";

type InviteData = {
  token: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  emailRaw: string;
  phoneRaw: string | null;
  committee: { id: string; name: string };
};

type Step = "loading" | "error" | "confirm" | "channel" | "otp" | "password" | "done";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, loading: authLoading, establishSession } = useApp();

  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Invalid invite");
        return data as InviteData;
      })
      .then((data) => {
        setInvite(data);
        setEmail(data.emailRaw);
        setPhone(data.phoneRaw ?? "");
        setStep("confirm");
      })
      .catch((e: Error) => {
        setError(e.message);
        setStep("error");
      });
  }, [token]);

  const confirmContacts = async () => {
    if (!invite) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/invites/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone: phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save details");
      setStep("channel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save details");
    } finally {
      setSubmitting(false);
    }
  };

  const sendOtp = async () => {
    if (!invite) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: invite.userId,
          channel,
          purpose: "INVITE",
          inviteToken: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!invite) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: invite.userId,
          code: otpCode.trim(),
          purpose: "INVITE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      setStep("password");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  const finishSetup = async () => {
    if (!invite) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: invite.userId,
          password: newPassword,
          purpose: "INVITE",
          inviteToken: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not set password");
      establishSession(data);
      setStep("done");
      router.replace(`/c/${invite.committee.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set password");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (user && step !== "done" && step !== "loading" && step !== "error") {
      router.replace("/");
    }
  }, [user, step, router]);

  if (authLoading && step === "loading") {
    return <p className="text-center py-16 text-muted">Loading…</p>;
  }

  if (user && step !== "done" && step !== "error") {
    return <p className="text-center py-16 text-muted">Redirecting…</p>;
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-surface">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo size={72} />
          </div>
          <h1 className="text-2xl font-bold text-charcoal">Join Steward</h1>
          {invite && (
            <p className="text-muted text-sm">
              You&apos;ve been invited to {invite.committee.name}
            </p>
          )}
        </div>

        <div className="bg-white rounded-3xl border-2 border-charcoal/10 p-6 space-y-4 shadow-sm">
          {step === "error" && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
          )}

          {step === "confirm" && invite && (
            <>
              <p className="text-sm font-semibold text-charcoal">
                Hi {invite.name}, are these details correct?
              </p>
              <label className="block text-xs font-bold text-muted uppercase">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FORM_FIELD_CLASS}
              />
              <label className="block text-xs font-bold text-muted uppercase">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="For SMS verification"
                className={FORM_FIELD_CLASS}
              />
              {error && (
                <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
              )}
              <TouchButton
                size="lg"
                className="w-full"
                disabled={submitting}
                onClick={confirmContacts}
              >
                Yes, continue
              </TouchButton>
            </>
          )}

          {step === "channel" && (
            <>
              <p className="text-sm font-semibold text-charcoal">
                Where should we send your verification code?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!email}
                  onClick={() => setChannel("EMAIL")}
                  className={`flex-1 h-14 rounded-xl border font-semibold ${
                    channel === "EMAIL"
                      ? "border-primary bg-primary/10"
                      : "border-charcoal/10"
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  disabled={!phone}
                  onClick={() => setChannel("SMS")}
                  className={`flex-1 h-14 rounded-xl border font-semibold ${
                    channel === "SMS"
                      ? "border-primary bg-primary/10"
                      : "border-charcoal/10"
                  }`}
                >
                  SMS
                </button>
              </div>
              {error && (
                <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
              )}
              <TouchButton
                size="lg"
                className="w-full"
                disabled={submitting || (channel === "SMS" && !phone)}
                onClick={sendOtp}
              >
                Send code
              </TouchButton>
            </>
          )}

          {step === "otp" && (
            <>
              <p className="text-sm text-muted">
                Enter the 6-digit code we sent via {channel === "EMAIL" ? "email" : "SMS"}.
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className={`${FORM_FIELD_CLASS} tracking-widest text-center text-lg`}
              />
              {error && (
                <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
              )}
              <TouchButton
                size="lg"
                className="w-full"
                disabled={otpCode.trim().length < 6 || submitting}
                onClick={verifyOtp}
              >
                Verify
              </TouchButton>
            </>
          )}

          {step === "password" && (
            <>
              <p className="text-sm font-semibold text-charcoal">Create your password</p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={FORM_FIELD_CLASS}
              />
              {error && (
                <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
              )}
              <TouchButton
                size="lg"
                className="w-full"
                disabled={newPassword.length < 8 || submitting}
                onClick={finishSetup}
              >
                Finish setup
              </TouchButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
