/**
 * LibraryDocument is the CreativeWork; file `Document` is MediaObject-like.
 * Links to Tasks/Events use DocumentLink.relation (ABOUT | EVIDENCE | PART_OF) —
 * see domain-vocab.ts and PRODUCT.md domain vocabulary.
 */
export {
  LINK_RELATIONS,
  LINK_RELATION_LABELS,
  defaultLinkRelation,
  isLinkRelation,
  linkRelationDisplayLabel,
  type LinkRelation,
} from "@/lib/domain-vocab";

export const LIBRARY_DOCUMENT_TAGS = [
  "REPORT",
  "MINUTES",
  "POLICY",
  "BRIEF",
  "FORM",
  "TOR",
  "OTHER",
] as const;

export type LibraryDocumentTag = (typeof LIBRARY_DOCUMENT_TAGS)[number];

export const LIBRARY_DOCUMENT_TAG_LABELS: Record<LibraryDocumentTag, string> = {
  REPORT: "Report",
  MINUTES: "Minutes",
  POLICY: "Policy",
  BRIEF: "Brief",
  FORM: "Form",
  TOR: "TOR",
  OTHER: "Other",
};

export const DOCUMENT_SOURCE_LABELS = {
  UPLOAD: "Attachment",
  CREATED: "Created in Steward",
} as const;

export const NATIVE_DOC_KINDS = ["DOCUMENT", "SPREADSHEET", "PRESENTATION"] as const;
export type NativeDocKind = (typeof NATIVE_DOC_KINDS)[number];

export const NATIVE_DOC_KIND_LABELS: Record<NativeDocKind, string> = {
  DOCUMENT: "Document",
  SPREADSHEET: "Spreadsheet",
  PRESENTATION: "Presentation",
};

export const LIBRARY_DOCUMENT_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "RETURNED",
] as const;

export type LibraryDocumentStatus = (typeof LIBRARY_DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<LibraryDocumentStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Pending approval",
  PUBLISHED: "Published",
  RETURNED: "Returned",
};

export const DOCUMENT_MEMBER_ROLES = [
  "OWNER",
  "EDITOR",
  "REVIEWER",
  "APPROVER",
] as const;

export type DocumentMemberRole = (typeof DOCUMENT_MEMBER_ROLES)[number];

export const DOCUMENT_ROLE_LABELS: Record<DocumentMemberRole, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  REVIEWER: "Reviewer",
  APPROVER: "Approver",
};

