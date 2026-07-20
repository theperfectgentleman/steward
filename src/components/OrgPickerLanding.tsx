"use client";

import Image from "next/image";
import Link from "next/link";
import { Church, LogOut, Shield, Users } from "lucide-react";
import landingBg from "@/assets/landing.png";
import { useApp } from "@/providers/AppProvider";

function OrgIcon({
  name,
  status,
}: {
  name: string;
  status: "ACTIVE" | "SUSPENDED";
}) {
  const lower = name.toLowerCase();
  const isFaith =
    lower.includes("church") ||
    lower.includes("icgc") ||
    lower.includes("fellowship") ||
    lower.includes("ministry") ||
    lower.includes("parish");
  const suspended = status === "SUSPENDED";

  return (
    <div className="relative aspect-square h-full">
      <div className="flex h-full w-full items-center justify-center rounded-[0.65rem] bg-primary/12 text-primary">
        {isFaith ? (
          <Church className="size-[1.15rem]" strokeWidth={1.75} />
        ) : (
          <Shield className="size-[1.15rem]" strokeWidth={1.75} />
        )}
      </div>
      <span
        className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white shadow-sm ${
          suspended ? "bg-amber-500" : "bg-primary"
        }`}
        title={suspended ? "Suspended" : "Active"}
        aria-label={suspended ? "Organization suspended" : "Organization active"}
      />
    </div>
  );
}

export function OrgPickerLanding() {
  const { user, enterOrganization, logout } = useApp();
  const memberships = user?.memberships ?? [];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Image
        src={landingBg}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/35 to-white/80"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-8 pt-5 sm:px-6">
        <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-stone-500 uppercase">
            Steward
          </p>
          <div className="flex items-center gap-1">
            {user?.isPlatformAdmin && (
              <Link
                href="/super"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-stone-500 transition hover:bg-white/60 hover:text-stone-800"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Super</span>
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-stone-500 transition hover:bg-white/60 hover:text-stone-800"
            >
              <span>Sign out</span>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div className="org-picker-enter text-center">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight tracking-tight text-stone-900 sm:text-[2.35rem]">
              Your organizations
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-stone-600">
              Welcome back
              {user?.name ? (
                <>
                  ,{" "}
                  <span className="font-semibold text-stone-800">
                    {user.name}
                  </span>
                </>
              ) : null}
              . Please select an organization to continue.
            </p>
          </div>

          <div className="mt-8 space-y-3.5">
            {memberships.length === 0 && (
              <div className="rounded-2xl border border-stone-200/80 bg-white/90 px-5 py-6 text-center text-sm text-stone-600 shadow-sm backdrop-blur-sm">
                You are not a member of any organization yet.
              </div>
            )}

            {memberships.map((m, index) => {
              const suspended = m.status === "SUSPENDED";
              const roleCount = m.roleCount ?? m.rolesSummary.length;
              const groupCount = m.groupCount ?? 0;
              const groupLabel =
                m.committeeLabel?.toLowerCase() === "committee"
                  ? groupCount === 1
                    ? "Group"
                    : "Groups"
                  : groupCount === 1
                    ? m.committeeLabel ?? "Group"
                    : `${m.committeeLabel ?? "Group"}s`;

              return (
                <article
                  key={m.organizationId}
                  className="org-picker-card rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
                    <div className="row-span-2 self-stretch">
                      <OrgIcon name={m.name} status={m.status} />
                    </div>
                    <h2 className="truncate text-[15px] leading-none font-bold tracking-wide text-stone-900 uppercase">
                      {m.name}
                    </h2>
                    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] leading-none text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Shield
                          className="h-3.5 w-3.5 shrink-0 text-stone-400"
                          strokeWidth={2}
                        />
                        {roleCount} Role{roleCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-stone-300" aria-hidden>
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users
                          className="h-3.5 w-3.5 shrink-0 text-stone-400"
                          strokeWidth={2}
                        />
                        {groupCount} {groupLabel}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={suspended}
                    onClick={() => enterOrganization(m.organizationId)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(47,158,122,0.28)] transition hover:bg-primary-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
                  >
                    {suspended ? "Unavailable" : "Enter"}
                  </button>
                </article>
              );
            })}
          </div>
        </main>

        <footer className="mx-auto w-full max-w-md pt-2 text-center text-[11px] tracking-wide text-stone-400">
          © {new Date().getFullYear()} Steward Platforms. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}
