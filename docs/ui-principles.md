# UnityCommit UI Principles

Extracted from reference project-management dashboards and applied to UnityCommit.

## 1. Desktop-first chrome, adaptive collapse

Wide screens use a left icon rail, optional committee list panel, and a spacious main workspace. Mobile collapses to a bottom dock and single-column cards. Mobile patterns are never imposed on desktop.

## 2. Persistent main nav

Primary destinations (Home, Tasks, Schedule, Minutes, Admin) stay visible on desktop via the icon rail. On mobile, the same destinations live in the bottom dock.

## 3. Contextual isolation

Inside a committee workspace (`/c/[committeeId]/…`), show only that committee's tasks, schedule, minutes, metrics, and alerts. Do not mix content from other committees in the same view.

## 4. Two dashboard altitudes

- **Overall Dashboard** (`/`) — aggregated KPIs, committee table, cross-committee alert feed for executives and multi-committee users.
- **Committee Dashboard** (`/c/[id]`) — focused snapshot for one committee only.

## 5. Hierarchy via nav + breadcrumbs

Breadcrumbs communicate context: `Overall → Estates & Projects → Tasks`. Users always know where they are and how to go back.

## 6. Modular card grid

KPI cards, feeds, and boards are independent modules. Desktop uses multi-column grids; mobile stacks the same modules vertically.

## 7. View modes inside a context

Within a committee: Overview, Board (Tasks), Schedule, Minutes. Each mode is scoped to the active committee.

## 8. Information density with scanning aids

Prefer compact spacing so executives can scan health without scrolling past empty card chrome. Use status badges, progress bars, and KPI numbers—readable, not oversized. Prefer `space-y-4`, `text-xl` page titles, and tight card padding (`px-3 py-2.5`) on content-heavy surfaces.

## 9. Local vs global controls

Global: navigation, profile, sign out. Local: filters, create actions, and board controls inside the active card or view.

## 10. Touch-friendly targets

Desktop/fine pointer: ~40×40px minimum. Coarse pointer and phones: ~44–48px. Do not inflate entire card layouts just to meet touch targets—apply targets to interactive controls.

## 11. Role-tailored landing

Depending on role and access, the landing dashboard shows stats and shortcuts relevant to that user—executives see all committees; members land in their committee workspace.

## Palette (hybrid PRD)

| Token | Use |
|-------|-----|
| White / Slate | Backgrounds, cards |
| Charcoal | Structure, nav, body text |
| Dark Gold | Brand headers, warnings, pending |
| Lime Green | Success, active nav, primary actions |

## Layout breakpoints

| Viewport | Shell |
|----------|-------|
| ≥1024px | Icon rail + committee panel + main content |
| <1024px | Top bar + bottom dock + sheet switcher |
