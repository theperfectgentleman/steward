import { Mark, mergeAttributes } from "@tiptap/core";

export type CommentHighlightAttrs = {
  threadId: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentHighlight: {
      setCommentHighlight: (threadId: string) => ReturnType;
      unsetCommentHighlight: () => ReturnType;
    };
  }
}

export const CommentHighlight = Mark.create({
  name: "commentHighlight",
  inclusive: false,
  excludes: "",
  keepOnSplit: true,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-thread-id"),
        renderHTML: (attrs) => {
          if (!attrs.threadId) return {};
          return { "data-thread-id": attrs.threadId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-thread-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, {
        class: "doc-comment-highlight",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentHighlight:
        (threadId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId }),
      unsetCommentHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
