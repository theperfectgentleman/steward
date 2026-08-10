"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { FileUp } from "lucide-react";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  uploadedBy: { name: string };
};

export function DocumentList({
  entityType,
  entityId,
  canUpload = false,
  canDelete = false,
}: {
  entityType: "TASK" | "LIBRARY_DOCUMENT";
  entityId: string;
  canUpload?: boolean;
  canDelete?: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Upload failed");
        return;
      }
      load();
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this attachment?")) return;
    const res = await fetch(`/api/attachments?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
      return;
    }
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
          Attachments
        </h3>
        {canUpload ? (
          <>
            <TouchButton
              size="md"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="h-4 w-4 mr-1" />
              {uploading ? "Uploading…" : "Upload"}
            </TouchButton>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No attachments yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-charcoal/10 px-3 py-2 text-sm"
            >
              <a
                href={`/api/attachments/${item.id}/file`}
                className="font-medium text-primary hover:underline truncate"
              >
                {item.fileName}
              </a>
              <span className="text-xs text-muted shrink-0">
                {item.uploadedBy.name}
              </span>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  className="text-xs font-semibold text-accent shrink-0 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
