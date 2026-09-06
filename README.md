# Steward

**Stage:** updating — committees collaborate on targets and assignments.

Governance operating system for organizations that run committees. The ICGC church workspace is **Template A** (demo tenant), not the product identity. Canonical direction: [docs/PRODUCT.md](./docs/PRODUCT.md).

Agent landing: [AGENT.md](./AGENT.md). History: [CHANGELOG.md](./CHANGELOG.md).

## Quick Start

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a demo profile.

## Demo Accounts

After sign-in, pick **ICGC** on the org picker. Seeded in [prisma/seed.ts](./prisma/seed.ts):

| Role | Email |
|------|-------|
| Org Admin / Platform Super | admin@unitycommit.org |
| Org Tech | it@unitycommit.org |
| Supervisory Head (GO) | overseer@unitycommit.org |
| Supervisory Secretary (GS) | gs@unitycommit.org |
| Committee Chair | grace@unitycommit.org |
| Committee Secretary | james@unitycommit.org |
| Committee Member | ama@unitycommit.org |

Platform Super console: `admin@unitycommit.org` → `/super` (requires `SUPER_PASSWORD`).

## Features

- **Five peers** — Home · Work · Events · Docs · Messages (`src/lib/nav.ts`)
- **Multi-tenant orgs** — picker landing, active org, `/super` platform console
- **RBAC** — Org Admin / Org Tech / participant; committee + supervisory hats
- **Tasks** — Directive / Work / Personal (`workClass`), assignee, dual approval stacks
- **Events** — meetings + minutes nested on the event; RSVP / attendance
- **Docs** — library + collaborative studio (TipTap / Yjs when collab is up)
- **Invites** — upsert an org seat (`OrganizationMembership`) then a node role
- **PWA** — installable via web manifest; lime / gold / charcoal, 48px+ tap targets
- **Template A** — ICGC seed with 19 charter committees (a–s)

See [docs/PRODUCT.md](./docs/PRODUCT.md) for product law. [prd.md](./prd.md) is historical Template A / UX reference. Deploy: [docs/DEPLOY.md](./docs/DEPLOY.md).
