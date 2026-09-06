# Changelog

All notable changes to Steward are documented here.

## [Unreleased]

## [2026-09-06] — Agent memory

- Added root [AGENT.md](./AGENT.md) (standard sections + org-seat monetization)
- Added this changelog
- Linked both from [README.md](./README.md); refreshed demo roles to match [prisma/seed.ts](./prisma/seed.ts)

## [2026-08-17] — Tenant-key work and governance caps

- Required `organizationId` on Task, Event, and LibraryDocument; PERSONAL tasks may omit `committeeId` (PR #2)
- Meeting mutate APIs stay 410; attendance writes via `/api/events/:id/attendance`
- Committee delete returns 409 while open COMMITTEE/DIRECTIVE children exist
- Split `work-context` so client bundles do not pull auth/prisma (PR #4)
- Governance lead capabilities (`isGovernanceLeadSeat`, `applyGovernanceLeadCaps`) in session/auth
- Admin links on SidebarNav / UserMenu; dynamic “All my groups” label
- `SUPER_PASSWORD`, `mustChangePassword`, invite `orgRole`, ActivityLog `organizationId`

## [2026-08-10] — Collab, storage, Task-only seed

- Hocuspocus document collab server on :1234 (Docker / Dokploy)
- Cloudflare R2 for uploads; Brevo email / SMS env
- Prisma migrations for Phases 3–7; seed dropped legacy Project ceremony

## [2026-07] — Multi-tenant platform and UnityCommit MVP

- Organization tenancy, ICGC demo org, org picker, `/super`, Org Admin rename
- Postgres + Docker/Dokploy deploy path; AppProvider session/org state
- Invite onboarding, structure/RBAC/admin surfaces
- Initial UnityCommit MVP (PR #1): PWA, 19 charter committees, tasks, schedule, minutes, RBAC
