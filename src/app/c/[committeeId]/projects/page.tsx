"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { ProjectsView } from "@/components/views/ProjectsView";

export default function ProjectsPage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <ProjectsView />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
