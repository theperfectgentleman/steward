# Changelog

All notable changes to Steward are documented here.

## [Unreleased]

## [2026-09-09] — Fix document live co-edit

Live Docs collab (Hocuspocus / Yjs / TipTap) no longer silently drops to local editing when the socket is merely slow, and Next + `scripts/collab-server.cjs` now share the same token secret in local `.env.local`.

- Client (`CollaborativeDocEditor`): "Live sync" only after Yjs `synced`; 8s connect / 20s sync timeouts; recover if sync arrives; `DISABLE_COLLAB` / token errors skip the socket immediately instead of hanging on Connecting. Mixed-content `ws://` upgraded to `wss://` on HTTPS pages.
- Token API: `POST /api/documents/:id/collab-token` returns `{ mode: "local" }` when `DISABLE_COLLAB=1`; otherwise `{ mode: "live", token, wsUrl }`.
- Collab server: loads `.env` / `.env.local` in Next's order; HMAC must match Next; `connection.readOnly` from token `canWrite`; DB load/store errors no longer kill the session; HTTP GET `:1234/` still returns `OK`.
- Tests: `npm test` (token HMAC, connect decisions, presence, CJS server helpers).

### Verify (local)

```bash
cp .env.example .env   # keep COLLAB_TOKEN_SECRET and COLLAB_WS_URL=ws://localhost:1234
npm test
npm run db:setup
npm run dev:all
# curl -fsS http://127.0.0.1:1234/  → OK
# Sign in → Docs → open a document → toolbar "Live sync"
# Second browser on the same doc: carets + edits
```

Prod still needs a public `COLLAB_WS_URL` (`wss://…`), the same `COLLAB_TOKEN_SECRET` on app + collab, ports 3000+1234, and WebSocket upgrade. No public host is recorded in-repo.

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
