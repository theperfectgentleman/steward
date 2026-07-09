"use client";

import { AuthGate } from "@/components/AuthGate";
import { MinutesView } from "@/components/views/MinutesView";

export default function MinutesPage() {
  return (
    <AuthGate>
      <MinutesView />
    </AuthGate>
  );
}
