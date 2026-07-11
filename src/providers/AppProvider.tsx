"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppSettings, CommitteeTitle, UserRole } from "@/lib/types";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  committeeIds: string[];
  committeeMemberships: { committeeId: string; title: CommitteeTitle }[];
  presbyteryMembership: { isHead: boolean } | null;
};

type AppContextValue = {
  user: SessionUser | null;
  activeCommitteeId: string | null;
  attentionCount: number;
  appSettings: AppSettings | null;
  setAttentionCount: (n: number) => void;
  setActiveCommitteeId: (id: string) => void;
  login: (identifier: string, password: string) => Promise<void>;
  establishSession: (user: SessionUser) => void;
  logout: () => void;
  loading: boolean;
  refreshAttention: () => void;
  refreshAppSettings: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const SESSION_KEY = "unitycommit-session";
const COMMITTEE_KEY = "unitycommit-committee";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeCommitteeId, setActiveCommitteeIdState] = useState<string | null>(
    null,
  );
  const [attentionCount, setAttentionCount] = useState(0);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  // Always true on server and first client render to avoid hydration mismatch.
  // Session is restored from the httpOnly cookie in useEffect below.
  const [loading, setLoading] = useState(true);

  const setActiveCommitteeId = useCallback((id: string) => {
    setActiveCommitteeIdState(id);
    localStorage.setItem(COMMITTEE_KEY, id);
  }, []);

  const refreshAppSettings = useCallback(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AppSettings | null) => {
        if (data) setAppSettings(data);
      })
      .catch(() => undefined);
  }, []);

  const refreshAttention = useCallback(() => {
    fetch("/api/attention")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.nowCount != null) setAttentionCount(data.nowCount);
      })
      .catch(() => undefined);
  }, []);

  const establishSession = useCallback((data: SessionUser) => {
    setUser(data);
    localStorage.setItem(SESSION_KEY, data.id);
    if (data.committeeIds.length > 0) {
      setActiveCommitteeId(data.committeeIds[0]);
    }
  }, [setActiveCommitteeId]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Login failed");
    }
    const data = (await res.json()) as SessionUser;
    establishSession(data);
  }, [establishSession]);

  const logout = useCallback(() => {
    setUser(null);
    setActiveCommitteeIdState(null);
    setAttentionCount(0);
    setAppSettings(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(COMMITTEE_KEY);
    fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    window.location.href = "/";
  }, []);

  useEffect(() => {
    const storedCommittee = localStorage.getItem(COMMITTEE_KEY);

    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionUser | null) => {
        if (data) {
          setUser(data);
          localStorage.setItem(SESSION_KEY, data.id);
          if (storedCommittee && data.committeeIds.includes(storedCommittee)) {
            setActiveCommitteeIdState(storedCommittee);
          } else if (data.committeeIds.length > 0) {
            setActiveCommitteeIdState(data.committeeIds[0]);
          }
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshAttention();
    refreshAppSettings();
    const interval = setInterval(refreshAttention, 60_000);
    const onFocus = () => refreshAttention();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, refreshAttention, refreshAppSettings]);

  const value = useMemo(
    () => ({
      user,
      activeCommitteeId,
      attentionCount,
      appSettings,
      setAttentionCount,
      setActiveCommitteeId,
      login,
      establishSession,
      logout,
      loading,
      refreshAttention,
      refreshAppSettings,
    }),
    [
      user,
      activeCommitteeId,
      attentionCount,
      appSettings,
      setActiveCommitteeId,
      login,
      establishSession,
      logout,
      loading,
      refreshAttention,
      refreshAppSettings,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
