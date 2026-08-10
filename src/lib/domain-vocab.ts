/**
 * Thin schema.org-inspired domain vocabulary for Steward.
 * Conceptual map only — product UI language stays Directive / Work / Review.
 * See docs/PRODUCT.md § Domain vocabulary.
 */

import type { EntityType } from "@/lib/types";

export type DomainKind =
  | "Organization"
  | "Person"
  | "Role"
  | "Event"
  | "CreativeWork"
  | "Action";

/** How a LibraryDocument (CreativeWork) relates to another entity. */
export type LinkRelation = "ABOUT" | "EVIDENCE" | "PART_OF";

export const LINK_RELATIONS: LinkRelation[] = ["ABOUT", "EVIDENCE", "PART_OF"];

export const LINK_RELATION_LABELS: Record<LinkRelation, string> = {
  ABOUT: "About",
  EVIDENCE: "Evidence",
  PART_OF: "Part of",
};

/** UI label for a link, adjusted by target kind. */
export function linkRelationDisplayLabel(
  relation: LinkRelation,
  entityType: EntityType | "EVENT" | "LIBRARY_DOCUMENT",
): string {
  if (entityType === "LIBRARY_DOCUMENT" && relation === "ABOUT") {
    return "Related";
  }
  if (entityType === "LIBRARY_DOCUMENT" && relation === "PART_OF") {
    return "Part of / appendix";
  }
  return LINK_RELATION_LABELS[relation];
}

/** Prisma / polymorphic EntityType → domain kind */
export function domainKindForEntityType(
  entityType: EntityType | "EVENT",
): DomainKind {
  switch (entityType) {
    case "TASK":
      return "Action";
    case "LIBRARY_DOCUMENT":
      return "CreativeWork";
    case "DOCUMENT":
      // Soft Event links are stored as DOCUMENT + event: prefix; file attachments are MediaObject-like
      return "CreativeWork";
    case "EVENT":
      return "Event";
    default:
      return "CreativeWork";
  }
}

export function linkRelationLabel(relation: LinkRelation): string {
  return LINK_RELATION_LABELS[relation];
}

export function isLinkRelation(value: unknown): value is LinkRelation {
  return (
    typeof value === "string" &&
    (LINK_RELATIONS as string[]).includes(value)
  );
}

/**
 * Default DocumentLink.relation when the caller does not specify one.
 * Task → evidence for the Action; Event → document about the Event.
 */
export function defaultLinkRelation(
  entityType: EntityType | "EVENT",
): LinkRelation {
  if (entityType === "TASK") return "EVIDENCE";
  if (entityType === "EVENT") return "ABOUT";
  if (entityType === "LIBRARY_DOCUMENT") return "ABOUT";
  return "ABOUT";
}

/** Map Steward model names used in reviews / comments to DomainKind. */
export const MODEL_DOMAIN_KIND: Record<string, DomainKind> = {
  Organization: "Organization",
  Committee: "Organization",
  SupervisoryGroup: "Organization",
  User: "Person",
  OrganizationMembership: "Role",
  CommitteeMember: "Role",
  SupervisoryMember: "Role",
  DocumentMember: "Role",
  Event: "Event",
  Meeting: "Event",
  LibraryDocument: "CreativeWork",
  Document: "CreativeWork",
  Task: "Action",
};
