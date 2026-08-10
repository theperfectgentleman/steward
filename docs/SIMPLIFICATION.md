# Steward Simplification

**Status:** Canonical IA + work-model law (demo-first)  
**Last updated:** 2026-07-27  
**Implements through:** Phase 3 (docs → nav → Home overview → Task-centric work class + review)  
**Related:** [PRODUCT.md](./PRODUCT.md) (superseded for nav / My work / Assignment cascade where they conflict). Domain kinds / named doc links: see **Domain vocabulary (schema.org thin layer)** in PRODUCT.md.

---

## Breaking-change policy (demo)

This is a **demo app**. Prefer clean breaks:

- **Do** delete obsolete routes, UI, and APIs when superseded; hard-redirect bookmarks.
- **Do** reseed; old demo states need not migrate in place.
- **Do** replace `approvalStack` with `directiveApprovalStack` + `committeeApprovalStack` (no forever dual field).
- **Don’t** dual-write Assignment + Task “for safety.”
- **Don’t** leave dead nav entries without redirects.
- **Don’t** preserve Project/Assignment UX for hypothetical production lock-in.

---

## Five peer tabs

| Peer | Role |
|------|------|
| **Home** | Stats and overviews only — not a parent of Tasks/Events, not a primary action inbox |
| **Tasks** | Direct destination; only first-class work object |
| **Events** | Direct destination (Schedule renamed); canonical `/events` |
| **Docs** | Document library |
| **Messages** | Threads |

Admin only via UserMenu / header for Org Admin. No “More” for members. No Reports / Assignments / My work / Projects as peers.

---

## Multi-hat and group context

- One login; **no mode switcher** for roles.
- **Group switcher** = filter context (like WhatsApp groups), including **All my groups**.
- Every task/event card shows **`{Group} · {My role there}`** (e.g. `Finance · Chair`).
- Tasks filters: **Needs me** · **Waiting for my review** · **By group**.

### Home altitudes

| Who | Home behavior |
|-----|---------------|
| Head / Secretary / `canViewAll` | Org-wide KPIs, committee cards, alert feed from Task/Event activity |
| Ordinary members | “My groups” glance — counts and deep-links |

Drill via committee cards → active group → Tasks/Events/Docs. Group filter **All** for cross-committee lists.

---

## Work model (Task only)

**Task is the only first-class work object.** Directives are Tasks with `workClass=DIRECTIVE`.

| `workClass` | UI label | Meaning | Review ladder (seed default) |
|-------------|---------|---------|------------------------------|
| `DIRECTIVE` | **Directive** | Governance mandate (person and/or committee) | **4:** Committee Secretary → Committee Chair → Governance Secretary → Governance Head |
| `COMMITTEE` | **Work** | Committee-scoped work (often child of Directive; also TOR-derived via Docs → Suggest work) | **2:** Committee Secretary → Committee Chair |
| `PERSONAL` | **Personal** | Optional personal step under work | **0:** complete only |

### Nesting and close rules

- Allow **two** nesting levels: Directive → Committee child → optional Personal.
- Personal steps are **optional** — do not block parent “Send for review.”
- Committee children of a Directive **must be accepted** before the parent Directive can close.
- Spine: **mandate → work → review → close.** Not Asana.

### What was removed from product

| Former surface | Disposition |
|----------------|-------------|
| Assignment pipeline | Break — migrate narratives onto Tasks; APIs retired |
| Projects as required parent | Break — tasks seed without project ceremony |
| Reports peer / pipeline nav | Break from nav; prefer library docs + Task evidence |
| My work peer | Redirect to Home; Home is overview only |

---

## Implementation phases (this effort)

0. Product law — this doc + PRODUCT.md updates  
1. Five-peer nav; delete/redirect legacy routes; group All; kill committee tab strip  
2. Role-aware Home on Task/Event stats; strip Assignment/MyWorkHub chrome  
3. Schema (`TaskWorkClass`, review fields, dual stacks); Task-only APIs; multi-hat UI; reseed (sanctuary seats walkthrough)

**Out of scope:** production dual-write, Admin wizard polish, Asana boards, Home as action inbox, sixth nav peer.
