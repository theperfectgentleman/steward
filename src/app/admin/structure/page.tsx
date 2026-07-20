"use client";

import { AuthGate } from "@/components/AuthGate";
import { StructureBuilderView } from "@/components/views/StructureBuilderView";

export default function StructurePage() {
  return (
    <AuthGate>
      <StructureBuilderView />
    </AuthGate>
  );
}
