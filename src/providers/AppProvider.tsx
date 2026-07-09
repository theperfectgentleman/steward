"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserRole } from "@/lib/types";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  committeeIds: string[];
};

type AppContextValue = {
  user: SessionUser | null;
  activeCommitteeId: string | null;
  setActiveCommitteeId: (id: string) => void;
  login: (userId: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

const SESSION_KEY = "unitycommit-session";
const COMMITTEE_KEY = "unitycommit-committee";

function hasStoredSession() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(SESSION_KEY);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeCommitteeId, setActiveCommitteeIdState] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(hasStoredSession);

  const setActiveCommitteeId = useCallback((id: string) => {
    setActiveCommitteeIdState(id);
    localStorage.setItem(COMMITTEE_KEY, id);
  }, []);

  const login = useCallback(async (userId: string) => {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Login failed");
    const data = (await res.json()) as SessionUser;
    setUser(data);
    localStorage.setItem(SESSION_KEY, userId);
    if (data.committeeIds.length > 0) {
      setActiveCommitteeId(data.committeeIds[0]);
    }
  }, [setActiveCommitteeId]);

  const logout = useCallback(() => {
    setUser(null);
    setActiveCommitteeIdState(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(COMMITTEE_KEY);
    fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const storedUserId = localStorage.getItem(SESSION_KEY);
    if (!storedUserId) return;

    const storedCommittee = localStorage.getItem(COMMITTEE_KEY);

    fetch(`/api/auth/session?userId=${storedUserId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionUser | null) => {
        if (data) {
          setUser(data);
          if (storedCommittee && data.committeeIds.includes(storedCommittee)) {
            setActiveCommitteeIdState(storedCommittee);
          } else if (data.committeeIds.length > 0) {
            setActiveCommitteeIdState(data.committeeIds[0]);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      activeCommitteeId,
      setActiveCommitteeId,
      login,
      logout,
      loading,
    }),
    [user, activeCommitteeId, setActiveCommitteeId, login, logout, loading],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
