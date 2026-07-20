"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CommitteeTitle,
  OrganizationMemberRole,
  OrganizationSettings,
  UserRole,
} from "@/lib/types";
import { filterDismissedAttention } from "@/lib/attention-dismiss";
import type { AttentionItem } from "@/lib/attention";

export type OrgMembershipCard = {
  organizationId: string;
  name: string;
  slug?: string;
  status: "ACTIVE" | "SUSPENDED";
  orgRole: OrganizationMemberRole;
  rolesSummary: string[];
  roleCount?: number;
  groupCount?: number;
  supervisoryLabel?: string;
  committeeLabel?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isPlatformAdmin?: boolean;
  activeOrganizationId?: string | null;
  organization?: {
    id: string;
    name: string;
    status: "ACTIVE" | "SUSPENDED";
    orgRole: OrganizationMemberRole;
    settings: OrganizationSettings;
  } | null;
  memberships?: OrgMembershipCard[];
  committeeIds: string[];
  committeeMemberships: {
    committeeId: string;
    title: CommitteeTitle;
    customTitle?: string | null;
  }[];
  supervisoryMembership: {
    isHead: boolean;
    title?: string;
    customTitle?: string | null;
  } | null;
  /** @deprecated */
  presbyteryMembership?: {
    isHead: boolean;
    title?: string;
    customTitle?: string | null;
  } | null;
};

type AppContextValue = {
  user: SessionUser | null;
  activeCommitteeId: string | null;
  attentionCount: number;
  appSettings: OrganizationSettings | null;
  setAttentionCount: (n: number) => void;
  setActiveCommitteeId: (id: string) => void;
  login: (identifier: string, password: string) => Promise<void>;
  establishSession: (user: SessionUser) => void;
  enterOrganization: (organizationId: string) => Promise<void>;
  leaveOrganization: () => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshAttention: () => void;
  refreshAppSettings: () => void;
  refreshSession: () => Promise<void>;
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
  const [appSettings, setAppSettings] = useState<OrganizationSettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const setActiveCommitteeId = useCallback((id: string) => {
    setActiveCommitteeIdState(id);
    localStorage.setItem(COMMITTEE_KEY, id);
  }, []);

  const refreshAppSettings = useCallback(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrganizationSettings | null) => {
        if (data) setAppSettings(data);
      })
      .catch(() => undefined);
  }, []);

  const refreshAttention = useCallback(() => {
    fetch("/api/attention")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const items = filterDismissedAttention<AttentionItem>(data.items ?? []);
        const nowCount = items.filter((i) => i.urgency === "NOW").length;
        setAttentionCount(nowCount);
      })
      .catch(() => undefined);
  }, []);

  const applySession = useCallback(
    (data: SessionUser) => {
      setUser({
        ...data,
        supervisoryMembership:
          data.supervisoryMembership ?? data.presbyteryMembership ?? null,
      });
      localStorage.setItem(SESSION_KEY, data.id);
      if (data.activeOrganizationId && data.committeeIds.length > 0) {
        const stored = localStorage.getItem(COMMITTEE_KEY);
        if (stored && data.committeeIds.includes(stored)) {
          setActiveCommitteeIdState(stored);
        } else {
          setActiveCommitteeId(data.committeeIds[0]);
        }
      } else {
        setActiveCommitteeIdState(null);
      }
      if (data.organization?.settings) {
        setAppSettings(data.organization.settings);
      }
    },
    [setActiveCommitteeId],
  );

  const establishSession = useCallback(
    (data: SessionUser) => {
      applySession(data);
    },
    [applySession],
  );

  const refreshSession = useCallback(async () => {
    const res = await fetch("/api/auth/session");
    if (!res.ok) {
      setUser(null);
      return;
    }
    const data = (await res.json()) as SessionUser;
    applySession(data);
  }, [applySession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
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
      applySession(data);
    },
    [applySession],
  );

  const enterOrganization = useCallback(
    async (organizationId: string) => {
      const res = await fetch("/api/orgs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not enter organization");
      }
      await refreshSession();
    },
    [refreshSession],
  );

  const leaveOrganization = useCallback(async () => {
    await fetch("/api/orgs/active", { method: "DELETE" });
    setAppSettings(null);
    setAttentionCount(0);
    setActiveCommitteeIdState(null);
    localStorage.removeItem(COMMITTEE_KEY);
    await refreshSession();
  }, [refreshSession]);

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
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionUser | null) => {
        if (data) applySession(data);
        else localStorage.removeItem(SESSION_KEY);
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
      .finally(() => setLoading(false));
  }, [applySession]);

  useEffect(() => {
    if (!user?.activeOrganizationId) return;
    refreshAttention();
    refreshAppSettings();
    const interval = setInterval(refreshAttention, 60_000);
    const onFocus = () => refreshAttention();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.activeOrganizationId, refreshAttention, refreshAppSettings]);

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
      enterOrganization,
      leaveOrganization,
      logout,
      loading,
      refreshAttention,
      refreshAppSettings,
      refreshSession,
    }),
    [
      user,
      activeCommitteeId,
      attentionCount,
      appSettings,
      setActiveCommitteeId,
      login,
      establishSession,
      enterOrganization,
      leaveOrganization,
      logout,
      loading,
      refreshAttention,
      refreshAppSettings,
      refreshSession,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
