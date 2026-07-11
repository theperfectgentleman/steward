"use client";

import { AuthGate } from "@/components/AuthGate";
import { DocumentsView } from "@/components/views/DocumentsView";

export default function DocumentsPage() {
  return (
    <AuthGate>
      <DocumentsView />
    </AuthGate>
  );
}
