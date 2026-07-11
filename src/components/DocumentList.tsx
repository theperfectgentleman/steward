"use client";

import { DocumentUploadsComingSoon } from "@/components/ComingSoonBanner";
import { TouchButton } from "@/components/TouchButton";
import { FileUp } from "lucide-react";

export function DocumentList() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
          Documents
        </h3>
        <TouchButton size="md" disabled className="opacity-60">
          <FileUp className="h-4 w-4 mr-1" />
          Upload
        </TouchButton>
      </div>
      <DocumentUploadsComingSoon />
      <p className="text-sm text-muted">
        Attached files will appear here once uploads are enabled.
      </p>
    </div>
  );
}
