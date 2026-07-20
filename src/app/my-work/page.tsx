"use client";

import { AuthGate } from "@/components/AuthGate";
import { MyWorkView } from "@/components/views/MyWorkView";

export default function MyWorkPage() {
  return (
    <AuthGate>
      <MyWorkView />
    </AuthGate>
  );
}
