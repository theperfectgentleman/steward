# Product Requirement Document (PRD)
## Project Name: UnityCommit (Unified Church Committee Workspace)

> **Superseded for product direction.** Steward’s canonical vision, naming, multi-tenant model, and upgrade phases live in **[docs/PRODUCT.md](docs/PRODUCT.md)**.  
> This PRD is retained as **historical / Template A** context (the church demo that will migrate to organization **ICGC**). UX and touch-target rules below remain useful reference; do not treat the church-only domain model or “Super Admin” naming here as current product law.

**Document Version:** 1.0.0  
**Target Release:** Q4 2026  
**Author:** Lead IT Committee Systems Architect

## 1. Executive Summary & Core Objectives
### 1.1 Problem Statement
The church operates with 19 distinct, highly specialized committees (including Finance, Missions, Estates & Projects, and Disciplinary). Currently, communication, goal tracking, scheduling, and task management happen in silos—using a mix of paper, group chats, personal spreadsheets, and disparate calendar apps. This leaves the General Overseer, Presbytery, and senior church hierarchy without a real-time, consolidated view of progress, while administrative volunteers are bogged down by complex or inaccessible desktop-first interfaces.
### 1.2 The Solution
**UnityCommit** is an adaptive, mobile-first Web Application (configured as a Progressive Web App) that serves as the single source of truth for all 19 church committees. It combines the heavy-duty utility and touch-friendly simplicity of field-operations software (like *Fieldwire*) with a premium, high-contrast, zero-learning-curve visual interface.
### 1.3 Key Success Metrics
 * **Adoption Rate:** >90\% active weekly participation across all 19 committee chairpersons and secretaries within 45 days of launch.
 * **Data Completeness:** 100\% of scheduled meetings logged with attendance and core actions directly inside the app.
 * **Executive Visibility:** Time spent by the General Overseer's office chasing down progress updates is reduced to zero, replaced by a real-time, self-updating dashboard.
## 2. Design & Accessibility Philosophy
The design is engineered from the ground up to support users with low technical literacy, varied mobile hardware, and physical touch constraints—specifically accommodating **women with long acrylic or natural fingernails**, who tap screens using the flat pads of their fingers rather than the tips.
```
       [ TOUCH TARGET COMPARISON ]
       
   Standard Mobile Target (Small/Crowded)
   +---+  <- Flat pad of finger overlaps
   | 24|     multiple targets, causing mis-taps.
   +---+
   
   UnityCommit Target (Nail & Pad Friendly)
   +-----------------------+
   |                       |
   |        48px - 56px    |  <- Generous padding, wide bounds.
   |                       |     Finger pad registers cleanly.
   +-----------------------+
```
### 2.1 The Touch-Target Mandate (Nail-Friendly Interaction)
 * **Absolute Minimum Target Size:** No interactive element (button, form input, tab, icon) shall have a clickable/tappable zone smaller than 48 \times 48\text{ pixels}. Primary actions should default to 56 \times 56\text{ pixels} with a minimum of 12\text{ pixels} of separation margin between targets.
 * **Padded Hit Zones:** If a button visual appears small for stylistic balance, the actual DOM hit-target wrapper must expand invisibly beyond the border to capture flat finger-pad strikes.
 * **Zero Double-Taps:** Multi-step actions must utilize full-screen modal sheets rather than cascading menus.
### 2.2 Color Palette (Clean, High-Contrast Premium Aesthetic)
The palette emphasizes professional utility, premium church branding, and maximum legibility under bright outdoor sunlight or dim sanctuary lighting.
 1. **Primary Background & Base:** Pure White (#FFFFFF) and Crisp Slate/Light Gray (#F8FAFC).
 2. **Primary Accent / Direct Action Touchpoints:** **Lime Green** (#84CC16) — Used for success states, active selections, action confirmation buttons, and positive indicators.
 3. **Status & Premium Accent:** **Dark Gold** (#B45309) — Used for primary branding elements, high-level headers, special highlights, and warning/pending-approval indicators.
 4. **Neutral Contrast Anchor (The Fourth Color):** **Deep Charcoal** (#0F172A) — Deepest slate/black, used for highly legible body typography, structural borders, bottom navigation bars, and visual grounding.
## 3. User Roles & Permission Matrix
To prevent data chaos and protect sensitive information (such as *Legal* or *Disciplinary Committee* files), the app enforces strict **Role-Based Access Control (RBAC)** based on the standard church hierarchy.

| Role | System Capabilities | Scope of Access | Typical User |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Full system configuration, database exports, global user provisioning, system logs. | Global (All Committees) | IT Committee Lead, Systems Admin |
| **Church Executive** | Read-Only viewing of dashboards, reports, schedules, and Gantt charts. Cannot edit tasks or minutes. | Global (All 19 Committees) | General Overseer, Presbytery, Elders |
| **Committee Chairperson** | Create/Edit/Delete tasks, approve meeting minutes, set schedules, assign tasks to members. | Committee-Specific | Committee Chair |
| **Committee Secretary** | Log minutes, draft tasks, manage attendance, write schedule updates. | Committee-Specific | Committee Secretary |
| **Committee Member** | Update status of assigned tasks, view committee calendars, read approved minutes. | Committee-Specific | General Volunteer / Member | <br> ## 4. Feature Requirements <br> ### 4.1 Global Navigation & Dashboard <br> * **The Bottom Dock (Mobile & Tablet):** A persistent, oversized navigation bar locked to the bottom of the screen. <br> * *Icons:* Home (Dashboard), Tasks (Work Board), Schedule (Calendar/Gantt), Document (Minutes), Admin (Settings). <br> * *Target Size:* Large 64\text{px} high dock with icon labels to prevent icon confusion. <br> * **The Switcher Sheet:** A slide-up bottom sheet allowing Executive users to instantly switch their dashboard view between the 19 committees (listed a through s as per church charter). <br> ### 4.2 Task Management Engine (Fieldwire-Inspired) <br> Avoid complex Kanban dragging on small mobile screens. Instead, use a tap-centric vertical grid layout. <br> ``` <br> +-------------------------------------------------------+
| [Task Card: Soundboard Installation] |
| Status: [ ToDo ] -> [ In-Progress ] -> [[ Done ]] | <-- Large physical segment buttons
| Due Date: Oct 12, 2026 |
| Assigned To: James Osei |

+-------------------------------------------------------+
```
 * **Segmented Control Toggles:** Change status (ToDo, In-Progress, Blocked, Done) using massive, physical segment-style toggle panels instead of tiny dropdown arrows.
 * **Task Assignment Sheet:** Tapping "Assign To" opens a slide-up bottom drawer containing large, rounded rows with member initials and names, with at least 16\text{px} gap between rows.
### 4.3 Schedules & Deadlines (Calendar)
 * **Continuous Vertical Agenda View:** Avoid the traditional "month grid" on mobile screens, which forces users to press tiny day squares. Provide an infinite scroll vertical chronological list of church events, deadlines, and meetings.
 * **Event RSVP/Attendance Buttons:** Simple, huge "Going" (Lime Green) and "Declined" (Charcoal Slate) toggles for committee members.
### 4.4 Simplified Touch Gantt Chart (Timeline View)
Traditional desktop Gantt charts are unusable on phones. UnityCommit introduces a **Simplified Horizon Timeline**:
 * **The Track Grid:** Committees see their goals plotted on a clean, horizontal weekly track.
 * **Oversized Handle Adjustment:** To adjust start or end dates, users tap a date block to open a large visual timeline modal. Slider handles on mobile feature circular touch bubbles (48\text{px} diameter) to easily slide timelines without fingernail obstructions.
 * **Progress Fill Indicator:** An elegant, Dark Gold progress bar inside a Lime Green track showing actual completion vs. planned timelines.
### 4.5 Meeting & Minutes Logger (Secretary Portal)
The lifeblood of committee tracking. The platform must make writing and filing minutes painless:
 * **Quick-Log Attendance Grid:** A grid of all committee members showing their photos/initials. The Secretary taps each person to toggle their status: Present (Lime Green border), Excused (Dark Gold border), or Absent (Charcoal border).
 * **Structured Bullet point Engine:** Instead of freeform text areas that invite formatting errors on mobile keyboards, the Secretary enters minutes as structured bullet items. Tapping [ + Add Point ] opens a focused, oversized input card.
### 4.6 Church Hierarchy Executive Dashboard (The Presbytery View)
Designed for the General Overseer and Presbytery to track overall progress from a mobile device or tablet in seconds.
 * **Progress Health Rings:** Standard circular widgets displaying the ratio of Completed vs. Blocked tasks across all 19 committees.
 * **The Alert Feed:** A real-time, aggregated chronological feed highlighting:
   * *Critical roadblocks* (Tasks marked "Blocked").
   * *Recently completed major milestones* (e.g., "Estates Committee completed Sanctuary Seating Upgrade").
   * *Meeting minutes filed* needing formal review.
 * **PDF Report Generator:** A simple, high-visibility button (Export Monthly Presbytery Report) that generates a clean, highly structured PDF summary of all active committees.
## 5. Admin Management & Permissions Section
The Admin interface is built with the same premium, high-contrast, large-button design, allowing System Admins to easily configure the platform from their mobile device during or after services.
### 5.1 User Directory & Provisioning
 * **Create New User form:** A vertical, single-column wizard. Input fields include Name, Email, Phone, and User Role. Every text input must be at least 52\text{px} tall to allow spacious touch focus.
 * **Interactive Committee Pairing:**
   * Select a user, tap "Assign Committee".
   * A list of the 19 committees appears as large, multi-select rows. Tapping a row toggles a bright Lime Green checkmark.
   * Designate the user's specific title inside that committee via a segmented selector: [ Chair ] [ Secretary ] [ Member ].
### 5.2 Committee Meta Configurations
 * Admin can set custom labels, operational budgets, and reporting frequencies for each of the 19 committees.
 * System-wide configuration to add/edit/archive committees.
## 6. Adaptive Screen Layout Specifications

| Feature / Screen | Mobile Viewport (320\text{px} - 480\text{px}) | Tablet Viewport (768\text{px} - 1024\text{px}) | Desktop Viewport (>1024\text{px}) |
| :--- | :--- | :--- | :--- |
| **Dashboard** | Single column stack. Quick-actions at top. Alert feed below. | Split view: Quick-stats on left, interactive alert list on right. | Three columns: Left sidebar, central visual analytics, right dynamic alert stream. |
| **Task Board** | Single-card focused view with large tap controls. | Two-column card grid (ToDo / In-Progress). | Full Kanban swimlanes (ToDo, In-Progress, Blocked, Done). |
| **Gantt / Timeline** | Swipeable 1-Week Horizon grid with simple progress bars. | 1-Month Horizon grid with interactive slider bubbles. | Multi-month comprehensive timeline grid with drag-and-drop. |
| **Form Inputs** | Full-width, single-column elements. 52\text{px} tall touch height. | Two-column grid with spacious padding. | Structured grid, integrated tooltips, unified floating panels. |

## 7. Technical Architecture & Non-Functional Requirements
### 7.1 Tech Stack Recommendation
 * **Front-end:** React.js or Next.js with Tailwind CSS (enforcing strict padding presets e.g., p-4, py-3, h-14 to secure touch targets).
 * **PWA Wrapper:** Standard manifest configurations and service workers enabling installable web-app execution, splash screens, and zero browser navigation chrome.
 * **Database:** A flexible, relational database structure to map users, permissions, committees, tasks, calendar schedules, and minutes.
### 7.2 Security & Data Integrity
 * **Encryption:** Full SSL/TLS encryption for all data transits.
 * **Session Management:** Secure token-based session parameters with long expirations (e.g., 30 days) so volunteers don't have to constantly type passwords on mobile.
 * **Automatic Backup:** Daily automated database backups to prevent loss of critical legal and financial tracking records.
### 7.3 Performance Optimization
 * **Load Time:** The app should load the core dashboard shell in under 1.5\text{ seconds} on standard mobile connections.
 * **Zero Jittering:** Transition animations between sheets must run at a smooth 60\text{ fps} to mimic a native app feel.
## 8. Implementation Phases & Rollout Plan
### Phase 1: MVP Setup & Core Architecture (Weeks 1 - 4)
 * Deploy database structure, user schemas, and core auth.
 * Implement PWA wrappers and baseline layout grid (White, Lime, Gold, Charcoal).
 * Build the Admin Management portal to populate the 19 committees and seed volunteer profiles.
### Phase 2: Functional Committee Workspace (Weeks 5 - 8)
 * Deploy Task Management engine with wide tap targets and Segmented Control toggles.
 * Deploy Meeting Logger & Minutes entry suite.
 * Integrate Simplified Timeline/Gantt view.
### Phase 3: Presbytery View & Dashboard Consolidation (Weeks 9 - 11)
 * Build aggregated Church Executive dashboards for senior hierarchy.
 * Implement dynamic Alert Feed, Health Rings, and PDF report engines.
 * Conduct internal tests with the Information Technology Committee.
### Phase 4: Pilot Launch & Dynamic Onboarding (Weeks 12 - 14)
 * Pilot launch with a test group: **Estates & Projects Management Committee** and **Media and Communications Committee**.
 * Incorporate direct user feedback (specifically refining target sizes, padding, and form submission flows).
 * Full rollout across all 19 committees.