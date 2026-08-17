"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { LoginPicker } from "@/components/LoginPicker";
import { SuperConsoleView } from "@/components/views/SuperConsoleView";
import { PageLoader } from "@/components/loading/PageShimmer";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";

export default function SuperPage() {
  const { user, loading, logout } = useApp();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [unlockState, setUnlockState] = useState<
    "loading" | "locked" | "unlocked"
  >("loading");
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    setReady(true);
    if (user && !user.isPlatformAdmin) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.isPlatformAdmin) return;
    let cancelled = false;
    fetch("/api/super/unlock")
      .then(async (r) => {
        const data = (await r.json()) as {
          configured?: boolean;
          unlocked?: boolean;
        };
        if (cancelled) return;
        setConfigured(data.configured !== false);
        setUnlockState(data.unlocked ? "unlocked" : "locked");
      })
      .catch(() => {
        if (!cancelled) setUnlockState("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.isPlatformAdmin]);

  const unlock = async () => {
    if (!password) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/super/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Wrong password");
      }
      setPassword("");
      setUnlockState("unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wrong password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !ready) {
    return (
      <div className="min-h-dvh bg-stone-950">
        <PageLoader label="Loading Super…" />
      </div>
    );
  }

  if (!user) return <LoginPicker />;
  if (!user.isPlatformAdmin) return null;

  if (unlockState !== "unlocked") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-stone-950 px-4 text-stone-100">
        <div className="w-full max-w-sm space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-lime-400 uppercase">
              Steward Super
            </p>
            <h1 className="mt-2 text-xl font-semibold">Unlock console</h1>
            <p className="mt-2 text-sm text-stone-400">
              Enter the Super password to continue.
            </p>
          </div>
          {!configured && (
            <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
              Super password is not configured. Set SUPER_PASSWORD on the server.
            </p>
          )}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className={`${FORM_FIELD_CLASS} pr-12`}
              placeholder="Super password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void unlock()}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-400"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <TouchButton
            className="w-full"
            disabled={submitting || !password || !configured}
            onClick={() => void unlock()}
          >
            {submitting ? "Unlocking…" : "Unlock"}
          </TouchButton>
          <button
            type="button"
            onClick={logout}
            className="w-full text-sm text-stone-500"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <SuperConsoleView />;
}
