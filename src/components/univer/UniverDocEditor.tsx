"use client";

import { RichTextEditor } from "@/components/RichTextEditor";

/** Legacy non-collab doc editor (spreadsheet path / fallback). */
export function UniverDocEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="w-full flex-1 rounded-2xl border border-charcoal/15 bg-white p-4 shadow-sm">
        <div
          className="prose max-w-none p-4 text-charcoal leading-relaxed"
          dangerouslySetInnerHTML={{ __html: value || "<p>Empty document.</p>" }}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 rounded-2xl border border-charcoal/15 bg-white p-4 shadow-sm">
      <RichTextEditor
        value={value}
        onChange={onChange}
        minHeight="420px"
        placeholder="Start writing committee notes, policies, or report drafts…"
      />
    </div>
  );
}
