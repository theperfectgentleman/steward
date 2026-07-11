"use client";

import { AuthGate } from "@/components/AuthGate";
import { ProjectsView } from "@/components/views/ProjectsView";

export default function ProjectsPage() {
  return (
    <AuthGate>
      <ProjectsView />
    </AuthGate>
  );
}
