"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TouchButton } from "./TouchButton";
import { BrandLogo } from "./BrandLogo";
import { InstallAppPrompt } from "./InstallAppPrompt";
import { useApp } from "@/providers/AppProvider";
import { FORM_FIELD_CLASS } from "@/lib/form-field";

export function LoginPicker() {
  const { login } = useApp();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify" | "password">("request");
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [maskedDest, setMaskedDest] = useState("");

  const handleLogin = async () => {
    if (!identifier.trim() || !password) return;
    setSubmitting(true);
    setError("");
    try {
      await login(identifier.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const requestReset = async () => {
    if (!identifier.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setResetUserId(data.userId);
      setMaskedDest(data.maskedDestination ?? "");
      setResetStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyResetOtp = async () => {
    if (!resetUserId || !otpCode.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetUserId,
          code: otpCode.trim(),
          purpose: "LOGIN_RESET",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      setResetStep("password");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  const setPasswordAndLogin = async () => {
    if (!resetUserId || !newPassword) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetUserId,
          password: newPassword,
          purpose: "LOGIN_RESET",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not set password");
      await login(identifier.trim(), newPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-surface">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo size={88} priority />
          </div>
          <h1 className="text-3xl font-bold text-charcoal">Steward</h1>
          <p className="text-muted">Unified Church Committee Workspace</p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-charcoal/10 p-6 space-y-4 shadow-sm">
          {!resetMode ? (
            <>
              <p className="text-sm font-semibold text-charcoal">Sign in</p>
              <input
                type="text"
                placeholder="Email or phone"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className={FORM_FIELD_CLASS}
                autoComplete="username"
              />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${FORM_FIELD_CLASS} pr-12`}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/45 hover:text-charcoal focus:outline-none p-2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && (
                <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
              )}
              <TouchButton
                size="lg"
                className="w-full"
                disabled={!identifier.trim() || !password || submitting}
                onClick={handleLogin}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </TouchButton>
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setError("");
                  setResetStep("request");
                }}
                className="w-full text-sm text-primary font-medium"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-charcoal">Reset password</p>
              {resetStep === "request" && (
                <>
                  <input
                    type="text"
                    placeholder="Email or phone"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={FORM_FIELD_CLASS}
                  />
                  <div className="flex gap-2">
                    {(["EMAIL", "SMS"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChannel(c)}
                        className={`flex-1 h-12 rounded-xl border font-semibold text-sm ${
                          channel === c
                            ? "border-primary bg-primary/10 text-charcoal"
                            : "border-charcoal/10 text-muted"
                        }`}
                      >
                        {c === "EMAIL" ? "Email" : "SMS"}
                      </button>
                    ))}
                  </div>
                  <TouchButton
                    size="lg"
                    className="w-full"
                    disabled={!identifier.trim() || submitting}
                    onClick={requestReset}
                  >
                    Send code
                  </TouchButton>
                </>
              )}
              {resetStep === "verify" && (
                <>
                  <p className="text-sm text-muted">
                    Enter the code sent to {maskedDest || "your contact"}.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className={`${FORM_FIELD_CLASS} tracking-widest text-center text-lg`}
                  />
                  <TouchButton
                    size="lg"
                    className="w-full"
                    disabled={otpCode.trim().length < 6 || submitting}
                    onClick={verifyResetOtp}
                  >
                    Verify code
                  </TouchButton>
                </>
              )}
              {resetStep === "password" && (
                <>
                  <div className="relative w-full">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="New password (min 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${FORM_FIELD_CLASS} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/45 hover:text-charcoal focus:outline-none p-2"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <TouchButton
                    size="lg"
                    className="w-full"
                    disabled={newPassword.length < 8 || submitting}
                    onClick={setPasswordAndLogin}
                  >
                    Set password & sign in
                  </TouchButton>
                </>
              )}
              {error && (
                <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setError("");
                }}
                className="w-full text-sm text-muted"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>

        <InstallAppPrompt className="mt-2" />
      </div>
    </div>
  );
}
