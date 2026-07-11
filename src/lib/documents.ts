export const LIBRARY_DOCUMENT_TAGS = [
  "REPORT",
  "MINUTES",
  "POLICY",
  "BRIEF",
  "FORM",
  "OTHER",
] as const;

export type LibraryDocumentTag = (typeof LIBRARY_DOCUMENT_TAGS)[number];

export const LIBRARY_DOCUMENT_TAG_LABELS: Record<LibraryDocumentTag, string> = {
  REPORT: "Report",
  MINUTES: "Minutes",
  POLICY: "Policy",
  BRIEF: "Brief",
  FORM: "Form",
  OTHER: "Other",
};

export const DOCUMENT_SOURCE_LABELS = {
  UPLOAD: "Attachment",
  CREATED: "Created in Steward",
} as const;
