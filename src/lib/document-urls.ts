/** Client-safe paths to auth-gated file download routes. */

export function libraryDocumentFilePath(documentId: string): string {
  return `/api/documents/${documentId}/file`;
}

export function eventDeliverableFilePath(
  eventId: string,
  deliverableId: string,
): string {
  return `/api/events/${eventId}/deliverables/${deliverableId}/file`;
}

export function resolveLibraryFileHref(doc: {
  id: string;
  storageKey?: string | null;
  fileUrl?: string | null;
}): string | null {
  if (doc.storageKey) return libraryDocumentFilePath(doc.id);
  return doc.fileUrl?.trim() || null;
}
