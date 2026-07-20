"use client";

import { AuthGate } from "@/components/AuthGate";
import { MessagesView } from "@/components/views/MessagesView";

export default function MessagesPage() {
  return (
    <AuthGate>
      <MessagesView />
    </AuthGate>
  );
}
