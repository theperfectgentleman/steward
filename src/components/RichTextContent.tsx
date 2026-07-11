"use client";

const HTML_TAG = /<[a-z][\s\S]*>/i;

export function RichTextContent({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  if (!html.trim()) return null;

  if (!HTML_TAG.test(html)) {
    return (
      <p className={`text-charcoal leading-relaxed whitespace-pre-wrap ${className}`}>
        {html}
      </p>
    );
  }

  return (
    <div
      className={`rich-text-content text-charcoal leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
