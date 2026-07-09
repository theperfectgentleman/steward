# UnityCommit (Steward)

Unified church committee workspace — mobile-first PWA for task management, scheduling, minutes, and executive dashboards across 19 church committees.

## Quick Start

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a demo profile.

## Demo Accounts

| Role | Email |
|------|-------|
| Super Admin | admin@unitycommit.org |
| Church Executive | overseer@unitycommit.org |
| Committee Chair | grace@unitycommit.org |
| Committee Secretary | james@unitycommit.org |
| Committee Member | ama@unitycommit.org |

## Features (MVP)

- **Touch-friendly UI** — 48px+ tap targets, bottom sheet navigation, lime/gold/charcoal design system
- **RBAC** — Super Admin, Church Executive, Chair, Secretary, Member roles
- **19 Committees** — Charter committees (a–s) with switcher sheet
- **Task Board** — Segmented status controls, assignment drawer
- **Schedule** — Vertical agenda, RSVP toggles, timeline horizon
- **Minutes** — Attendance grid, structured bullet points
- **Presbytery Dashboard** — Health rings, alert feed, report export
- **Admin Portal** — User provisioning and committee pairing
- **PWA** — Installable via web manifest

See [prd.md](./prd.md) for full product requirements.
