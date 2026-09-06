# AGENT.md — Steward

## What this is

Governance operating system for groups that create working committees (companies, boards, alumni, churches, NGOs). Differentiator is **structure → mandate → work → review → close**, not generic project management.

**Task** is the only first-class work object (`workClass`: DIRECTIVE | COMMITTEE | PERSONAL). Events, minutes, and library documents support that loop. Church copy (Presbytery, charter a–s) is **Template A** for demo org **ICGC**, not the product identity.

Canonical product law: [docs/PRODUCT.md](./docs/PRODUCT.md). IA / Task model: [docs/SIMPLIFICATION.md](./docs/SIMPLIFICATION.md). Historical church PRD: [prd.md](./prd.md).

## Stage

**updating** — committees collaborate on targets and assignments.

Governance Assign creates a Directive Task (person and/or committee). Committees execute via nested Work / Personal children (`assignedToId` on `Task`). Review ladders: directive 4-step, committee 2-step, personal complete-only.

## Repo / hosts

- GitHub: `theperfectgentleman/steward`
- Live hosts: none documented in-repo (Dokploy + Docker notes in [docs/DEPLOY.md](./docs/DEPLOY.md); do not invent a public URL)

## Current status

Shipped in this tree (grounded in code, not the stale README-only MVP story):

- Multi-tenant spine: `Organization`, `OrganizationMembership`, org picker, active-org session — [prisma/schema.prisma](./prisma/schema.prisma), [src/lib/organizations.ts](./src/lib/organizations.ts), [src/app/api/orgs](./src/app/api/orgs)
- Platform Super at `/super` (`PlatformAdmin` + `SUPER_PASSWORD` unlock) — [src/app/super/page.tsx](./src/app/super/page.tsx), [src/lib/super-gate.ts](./src/lib/super-gate.ts)
- Org Admin vs Org Tech vs participant; supervisory group + configurable titles — [src/lib/types.ts](./src/lib/types.ts), [src/lib/role-capabilities.ts](./src/lib/role-capabilities.ts)
- Structure tree + RBAC matrix — `/admin/structure`, `/admin/rbac`
- Five peers: Home · Work · Events · Docs · Messages — [src/lib/nav.ts](./src/lib/nav.ts)
- Tenant-keyed Task / Event / LibraryDocument; Meeting mutate APIs frozen (410) — PRs #2 / #4
- Invites upsert an **org seat** (`OrganizationMembership`) then a committee or supervisory role — [src/lib/invites.ts](./src/lib/invites.ts) (`upsertSeat`)
- ICGC church demo seed (19 charter committees, GO/GS hats, sanctuary-seats walkthrough) — [prisma/seed.ts](./prisma/seed.ts), [src/lib/committees.ts](./src/lib/committees.ts)
- Optional collab (Hocuspocus/Yjs :1234), R2 uploads, Brevo/OTP, Groq suggest-then-accept AI — [docs/DEPLOY.md](./docs/DEPLOY.md), [.env.example](./.env.example)

Demo login after `npm run db:setup`: pick **ICGC** on the org picker. Platform Super: `admin@unitycommit.org` → `/super`.

## Not yet / blockers

- Billing / marketplace / seat metering UI (PRODUCT.md: out of scope until Super is stable)
- Nested subcommittees; multiple supervisory bodies per org; freeform organigram canvas
- Public live host + verified sending domain not recorded here
- Assignment / Project / Reports are **retired** as product peers — do not reintroduce (SIMPLIFICATION.md)
- Some church-era names remain in cookies/storage (`unitycommit-*`) and `package.json` name

## Monetization / positioning

**Hypothesis: B2B org seats.** Charge the organization, not the individual volunteer.

| Unit | Meaning in code | Why it is the meter |
|------|-----------------|---------------------|
| **Seat** | One `OrganizationMembership` (`organizationId` + `userId`) | Invite accept / add-to-org already upserts this row (`upsertSeat` in [src/lib/invites.ts](./src/lib/invites.ts)) |
| **Organization** | Tenant (`Organization.status` ACTIVE \| SUSPENDED) | Super creates/suspends orgs; one billable account per tenant |
| **Hat (not a seat)** | `CommitteeMember` / `SupervisoryMember` | Multi-hat inside one org is one seat; extra titles are not extra licenses |

Locked product facts that constrain billing:

- A user may belong to **many** orgs; each membership is a separate seat ([docs/PRODUCT.md](./docs/PRODUCT.md) § Locked defaults)
- Session has one **active organization**
- Do **not** invent prices, plan SKUs, or a live checkout — none exist in this repo
- Platform Super (`/super`) is the future place to set seat caps / suspend overage; Org Admin invites consume seats
- Explore later (not built): committee-budget add-on (`committeeBudgetsEnabled` already on `OrganizationSettings`), document storage overage (R2), paid AI quota (Groq)

Default: free-to-use for ICGC demo; money from org licenses when Super + metering ship.

## Architecture pointers

| Area | Path |
|------|------|
| Schema / tenancy | [prisma/schema.prisma](./prisma/schema.prisma) |
| Org create / templates / admin transfer | [src/lib/organizations.ts](./src/lib/organizations.ts) |
| Session + active org | [src/lib/session.ts](./src/lib/session.ts), [src/lib/auth.ts](./src/lib/auth.ts), [src/providers/AppProvider.tsx](./src/providers/AppProvider.tsx) |
| Permissions / hats | [src/lib/permissions-client.ts](./src/lib/permissions-client.ts), [src/lib/role-capabilities.ts](./src/lib/role-capabilities.ts) |
| Domain kinds | [src/lib/domain-vocab.ts](./src/lib/domain-vocab.ts) |
| Work / Tasks UI | [src/app/tasks](./src/app/tasks), [src/app/api/tasks](./src/app/api/tasks), [src/components/views/TasksView.tsx](./src/components/views/TasksView.tsx) |
| People assign | [src/components/people/PeoplePicker.tsx](./src/components/people/PeoplePicker.tsx) |
| Super | [src/app/super](./src/app/super), [src/app/api/super](./src/app/api/super) |
| Deploy | [docs/DEPLOY.md](./docs/DEPLOY.md), `Dockerfile`, `docker-compose.yml` |

Stack: Next.js 16 + React 19 + Tailwind 4, Prisma 7 + Postgres, PWA. Local: `npm install && npm run db:setup && npm run dev` (collab: `npm run dev:all`).

## How to continue

1. Keep committee collaboration on **targets** (Directive → Work → Personal) and **assignments** (`assignedToId`, PeoplePicker) as the product path — no Assignment/Project peers.
2. When Super is stable, meter seats: count `OrganizationMembership` per org; enforce on invite/accept in [src/lib/invites.ts](./src/lib/invites.ts); surface usage on `/super` and Org Admin.
3. Record a real live host in this file only after it exists.
4. Prefer reseed / delete / redirect over dual-write (demo policy in SIMPLIFICATION.md).

## Rules for agents

- Update `CHANGELOG.md` on every meaningful PR
- Keep this file Current status + How to continue fresh
- Do not invent prices or fake live hosts
- Product decisions land in `docs/PRODUCT.md` first; do not call org-level tech “Super Admin”
- Prefer Grok / Composer for cloud agents
