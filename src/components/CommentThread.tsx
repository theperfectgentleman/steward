"use client";

import { useCallback, useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { formatDateTime } from "@/lib/dates";
import type { EntityType } from "@/lib/types";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

export function CommentThread({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(
      `/api/comments?entityType=${entityType}&entityId=${entityId}`,
    )
      .then((r) => r.json())
      .then(setComments)
      .catch(() => undefined);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, entityType, entityId }),
      });
      setBody("");
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
        Comments
      </h3>
      {comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-charcoal/10 bg-white p-4"
            >
              <p className="text-sm text-charcoal">{c.body}</p>
              <p className="text-xs text-muted mt-2">
                {c.author.name} · {formatDateTime(c.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          className={FORM_TEXTAREA_CLASS}
        />
        <TouchButton size="md" onClick={submit} disabled={saving || !body.trim()}>
          Post comment
        </TouchButton>
      </div>
    </div>
  );
}
