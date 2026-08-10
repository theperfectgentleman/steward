import type { ScheduleKind } from "@/lib/types";

/** User-facing event type labels (ScheduleKind in schema). */
export const EVENT_KIND_LABELS: Record<ScheduleKind, string> = {
  MEETING: "Meeting",
  WORKING_VISIT: "Working visit",
  WORKSHOP: "Workshop",
  PROGRAM: "Program",
  OTHER: "Other",
};

/** @deprecated use EVENT_KIND_LABELS */
export const SCHEDULE_KIND_LABELS = EVENT_KIND_LABELS;

export const EVENT_KINDS: ScheduleKind[] = [
  "MEETING",
  "WORKING_VISIT",
  "WORKSHOP",
  "PROGRAM",
  "OTHER",
];

export type EventKindProfile = {
  agenda: boolean;
  minutes: boolean;
  rsvp: boolean;
  tasks: boolean;
  deliverables: boolean;
  emphasizeLocation: boolean;
};

export const EVENT_KIND_PROFILE: Record<ScheduleKind, EventKindProfile> = {
  MEETING: {
    agenda: true,
    minutes: true,
    rsvp: true,
    tasks: true,
    deliverables: true,
    emphasizeLocation: false,
  },
  WORKING_VISIT: {
    agenda: true,
    minutes: false,
    rsvp: true,
    tasks: true,
    deliverables: true,
    emphasizeLocation: true,
  },
  WORKSHOP: {
    agenda: true,
    minutes: false,
    rsvp: true,
    tasks: true,
    deliverables: true,
    emphasizeLocation: false,
  },
  PROGRAM: {
    agenda: false,
    minutes: false,
    rsvp: true,
    tasks: true,
    deliverables: true,
    emphasizeLocation: false,
  },
  OTHER: {
    agenda: true,
    minutes: false,
    rsvp: true,
    tasks: true,
    deliverables: true,
    emphasizeLocation: false,
  },
};

export function getEventKindProfile(kind: ScheduleKind | string): EventKindProfile {
  if (kind in EVENT_KIND_PROFILE) {
    return EVENT_KIND_PROFILE[kind as ScheduleKind];
  }
  return EVENT_KIND_PROFILE.OTHER;
}

export function deliverablesSectionTitle(kind: ScheduleKind): string {
  switch (kind) {
    case "WORKING_VISIT":
      return "Visit notes";
    case "WORKSHOP":
      return "Materials";
    default:
      return "Notes & links";
  }
}

export function deliverablesEmptyLabel(kind: ScheduleKind): string {
  switch (kind) {
    case "WORKING_VISIT":
      return "No visit notes yet.";
    case "WORKSHOP":
      return "No materials yet.";
    default:
      return "No notes or links yet.";
  }
}

export function agendaNotesLabel(kind: ScheduleKind): string {
  switch (kind) {
    case "WORKING_VISIT":
      return "Itinerary notes";
    case "WORKSHOP":
      return "Session notes";
    default:
      return "Agenda notes";
  }
}

export function agendaItemsLabel(kind: ScheduleKind): string {
  switch (kind) {
    case "WORKING_VISIT":
      return "Itinerary";
    case "WORKSHOP":
      return "Sessions";
    default:
      return "Agenda items";
  }
}
