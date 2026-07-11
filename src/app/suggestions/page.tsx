"use client";

import { AuthGate } from "@/components/AuthGate";
import { SuggestionsView } from "@/components/views/SuggestionsView";

export default function SuggestionsPage() {
  return (
    <AuthGate>
      <SuggestionsView />
    </AuthGate>
  );
}
