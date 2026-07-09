"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canViewAllCommittees } from "@/lib/types";

type Committee = {
  id: string;
  charterLetter: string;
  name: string;
};

export function CommitteeSwitcher() {
  const { user, activeCommitteeId, setActiveCommitteeId } = useApp();
  const [open, setOpen] = useState(false);
  const [committees, setCommittees] = useState<Committee[]>([]);

  useEffect(() => {
    if (!user) return;
    const scope = canViewAllCommittees(user.role) ? "all" : user.id;
    fetch(`/api/committees?scope=${scope}`)
      .then((r) => r.json())
      .then(setCommittees)
      .catch(() => setCommittees([]));
  }, [user]);

  if (!user || committees.length === 0) return null;

  const active = committees.find((c) => c.id === activeCommitteeId);

  if (committees.length === 1 && !canViewAllCommittees(user.role)) {
    return (
      <div className="text-sm font-medium text-muted truncate">
        {active?.name ?? "Committee"}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 touch-target-lg px-4 py-2 rounded-xl bg-white border-2 border-charcoal/10 hover:border-primary/50 transition-colors max-w-full"
      >
        <span className="text-xs font-bold text-accent uppercase">
          {active?.charterLetter ?? "?"}
        </span>
        <span className="text-sm font-semibold truncate">
          {active?.name ?? "Select Committee"}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Switch Committee">
        <ul className="space-y-3">
          {committees.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveCommitteeId(c.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left touch-target-lg transition-all ${
                  c.id === activeCommitteeId
                    ? "border-primary bg-primary/10"
                    : "border-charcoal/10 bg-white hover:border-charcoal/20"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white font-bold text-lg uppercase">
                  {c.charterLetter}
                </span>
                <span className="font-semibold text-charcoal">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
