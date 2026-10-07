"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Undo2,
  Redo2,
  MessageSquarePlus,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CommentHighlight } from "@/components/editor/CommentHighlight";
import {
  caretLabel,
  collapsePresenceByUser,
  colorForUserId,
  detectDeviceKind,
  type PresenceConnection,
  type PresencePerson,
} from "@/lib/document-presence";
import {
  COLLAB_CONNECT_TIMEOUT_MS,
  COLLAB_SYNC_TIMEOUT_MS,
  decideCollabConnect,
  shouldAbandonLiveConnect,
} from "@/lib/collab-connect";

export type { PresencePerson };

function ToolbarButton({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
        active
          ? "bg-primary/15 text-primary"
          : "text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal"
      }`}
    >
      {children}
    </button>
  );
}

export function CollaborativeDocEditor({
  documentId,
  initialHtml,
  readOnly,
  userId,
  userName,
  onHtmlChange,
  onReady,
  onCommentRequest,
  onHighlightClick,
  onPresence,
  onSyncState,
}: {
  documentId: string;
  initialHtml: string;
  readOnly: boolean;
  userId: string;
  userName: string;
  onHtmlChange?: (html: string) => void;
  onReady?: (editor: Editor) => void;
  onCommentRequest?: (selectionText: string, from: number, to: number) => void;
  onHighlightClick?: (threadId: string) => void;
  onPresence?: (people: PresencePerson[]) => void;
  onSyncState?: (state: "live" | "connecting" | "local") => void;
}) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [device] = useState(detectDeviceKind);
  const [synced, setSynced] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  useEffect(() => {
    onSyncState?.(fallback ? "local" : synced ? "live" : "connecting");
  }, [fallback, synced, onSyncState]);

  useEffect(() => {
    let cancelled = false;
    let abandoned = false;
    let connectTimer: number | undefined;
    let syncTimer: number | undefined;
    let everConnected = false;
    const ydocLocal = new Y.Doc();
    ydocRef.current = ydocLocal;

    const giveUp = (hp?: HocuspocusProvider | null) => {
      if (cancelled || abandoned) return;
      abandoned = true;
      if (connectTimer) window.clearTimeout(connectTimer);
      if (syncTimer) window.clearTimeout(syncTimer);
      setFallback(true);
      setSynced(false);
      setProvider(null);
      if (hp && providerRef.current === hp) {
        providerRef.current = null;
      }
      try {
        hp?.destroy();
      } catch {
        /* ignore */
      }
    };

    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/collab-token`, {
          method: "POST",
          credentials: "include",
        });
        const data: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        const decision = decideCollabConnect(res.status, data);
        if (decision.action === "local") {
          giveUp();
          return;
        }

        const hp = new HocuspocusProvider({
          url: decision.wsUrl,
          name: documentId,
          document: ydocLocal,
          token: () => decision.token,
          connect: true,
          onConnect: () => {
            everConnected = true;
            if (connectTimer) window.clearTimeout(connectTimer);
          },
          onDisconnect: () => {
            if (!cancelled) setSynced(false);
          },
          onSynced: ({ state }) => {
            if (cancelled || !state) return;
            if (connectTimer) window.clearTimeout(connectTimer);
            if (syncTimer) window.clearTimeout(syncTimer);
            setFallback(false);
            setSynced(true);
          },
          onAuthenticationFailed: () => {
            giveUp(hp);
          },
        });

        connectTimer = window.setTimeout(() => {
          if (
            shouldAbandonLiveConnect({
              cancelled,
              synced: hp.synced,
              everConnected,
              requireConnection: true,
            })
          ) {
            giveUp(hp);
          }
        }, COLLAB_CONNECT_TIMEOUT_MS);

        syncTimer = window.setTimeout(() => {
          if (
            shouldAbandonLiveConnect({
              cancelled,
              synced: hp.synced,
              everConnected,
              requireConnection: false,
            })
          ) {
            giveUp(hp);
          }
        }, COLLAB_SYNC_TIMEOUT_MS);

        if (cancelled || abandoned) {
          hp.destroy();
          return;
        }

        providerRef.current = hp;
        setProvider(hp);
        setYdoc(ydocLocal);
      } catch {
        if (!cancelled) giveUp();
      }
    })();

    return () => {
      cancelled = true;
      if (connectTimer) window.clearTimeout(connectTimer);
      if (syncTimer) window.clearTimeout(syncTimer);
      providerRef.current?.destroy();
      ydocLocal.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [documentId]);

  const useCollab = Boolean(ydoc && provider && !fallback);
  const userColor = colorForUserId(userId);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          undoRedo: useCollab ? false : undefined,
        }),
        Placeholder.configure({
          placeholder: "Start writing… Select text to add a comment.",
        }),
        CommentHighlight,
        ...(useCollab && ydoc && provider
          ? [
              Collaboration.configure({ document: ydoc }),
              CollaborationCaret.configure({
                provider,
                user: {
                  name: caretLabel(userName, device),
                  color: userColor,
                  id: userId,
                  device,
                },
              }),
            ]
          : []),
      ],
      content: useCollab ? undefined : initialHtml || "<p></p>",
      editorProps: {
        attributes: {
          class:
            "rich-text-editor__content outline-none px-4 py-3 text-charcoal text-base min-h-[50vh]",
        },
        handleClick: (_view, _pos, event) => {
          const target = event.target as HTMLElement | null;
          const mark = target?.closest?.("mark[data-thread-id]");
          if (mark) {
            const threadId = mark.getAttribute("data-thread-id");
            if (threadId) onHighlightClick?.(threadId);
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        onHtmlChange?.(ed.getHTML());
      },
      onCreate: ({ editor: ed }) => {
        onReady?.(ed);
        if (!useCollab && initialHtml) {
          ed.commands.setContent(initialHtml || "<p></p>", { emitUpdate: false });
        }
      },
    },
    [useCollab, ydoc, provider, readOnly, documentId, userId, userName, device, userColor],
  );

  useEffect(() => {
    if (!provider || !onPresence) return;
    const update = () => {
      const states = provider.awareness?.getStates() ?? new Map();
      const connections: PresenceConnection[] = [];
      states.forEach((state: Record<string, unknown>, clientId: number) => {
        const u = state?.user as
          | {
              name?: string;
              color?: string;
              id?: string;
              device?: PresenceConnection["device"];
            }
          | undefined;
        if (!u?.name) return;
        const uid = u.id || `anon:${u.name}`;
        const deviceFromLabel = (() => {
          const parts = u.name.split(" · ");
          const maybe = parts[parts.length - 1];
          if (maybe === "Phone" || maybe === "Tablet" || maybe === "Laptop") {
            return maybe;
          }
          return u.device || "Laptop";
        })();
        const displayName = u.id
          ? u.name.replace(/\s·\s(Phone|Tablet|Laptop)$/, "")
          : u.name;
        connections.push({
          clientId: String(clientId),
          userId: uid,
          name: displayName,
          color: u.color || colorForUserId(uid),
          device: deviceFromLabel,
        });
      });
      onPresence(collapsePresenceByUser(connections, userId));
    };
    provider.awareness?.on("change", update);
    update();
    return () => {
      provider.awareness?.off("change", update);
    };
  }, [provider, onPresence, userId]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Collab docs start with an empty Yjs fragment; seed from persisted HTML once.
  useEffect(() => {
    if (!editor || !provider || !useCollab) return;

    const seedFromHtml = () => {
      if (!provider.synced) return;
      const html = (initialHtml || "").trim();
      if (!html || html === "<p></p>") return;
      if (!editor.isEmpty) return;
      editor.commands.setContent(html, { emitUpdate: true });
    };

    if (provider.synced) {
      seedFromHtml();
      return;
    }

    const onSynced = () => seedFromHtml();
    provider.on("synced", onSynced);
    return () => {
      provider.off("synced", onSynced);
    };
  }, [editor, provider, useCollab, initialHtml]);

  if (!editor) {
    return (
      <div className="rounded-2xl border border-charcoal/15 bg-white p-8 text-sm text-muted">
        Loading editor…
      </div>
    );
  }

  const hasSelection = !editor.state.selection.empty;

  return (
    <div className="flex w-full flex-1 flex-col rounded-2xl border border-charcoal/15 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-charcoal/10 px-2 py-2">
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading"
          active={editor.isActive("heading", { level: 2 })}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Ordered list"
          active={editor.isActive("orderedList")}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        {!useCollab && (
          <>
            <ToolbarButton
              title="Undo"
              disabled={readOnly}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Redo"
              disabled={readOnly}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
        <div className="mx-1 h-5 w-px bg-charcoal/15" />
        <ToolbarButton
          title="Comment on selection"
          disabled={!hasSelection}
          onClick={() => {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, " ");
            onCommentRequest?.(text, from, to);
          }}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </ToolbarButton>
        <span className="ml-auto pr-2 text-[11px] text-muted">
          {fallback
            ? "Local editing"
            : synced
              ? "Live sync"
              : "Connecting…"}
        </span>
      </div>
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
}

export function applyCommentMark(
  editor: Editor,
  threadId: string,
  from?: number,
  to?: number,
) {
  if (typeof from === "number" && typeof to === "number") {
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .setCommentHighlight(threadId)
      .run();
    return;
  }
  editor.chain().focus().setCommentHighlight(threadId).run();
}
