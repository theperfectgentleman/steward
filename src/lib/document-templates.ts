import type { LibraryDocumentTag } from "@/lib/documents";

export type DocumentTemplate = {
  /** Short line shown in the create form when this type is selected. */
  description: string;
  /** TipTap-compatible HTML outline (h2/h3, lists, paragraphs). */
  html: string;
};

const blank = `<p></p>`;

export const DOCUMENT_TEMPLATES: Record<LibraryDocumentTag, DocumentTemplate> = {
  REPORT: {
    description: "Opens with summary, findings, recommendations, and next steps.",
    html: `<h2>Report</h2>
<p><strong>Prepared by:</strong> </p>
<p><strong>Date:</strong> </p>
<p><strong>Period / scope:</strong> </p>
<h3>Executive summary</h3>
${blank}
<h3>Background</h3>
${blank}
<h3>Findings</h3>
<ul>
<li></li>
</ul>
<h3>Recommendations</h3>
<ol>
<li></li>
</ol>
<h3>Next steps</h3>
<ul>
<li></li>
</ul>
<h3>Appendices</h3>
${blank}`,
  },
  MINUTES: {
    description: "Opens with attendees, agenda, decisions, and action items.",
    html: `<h2>Meeting minutes</h2>
<p><strong>Date:</strong> </p>
<p><strong>Time:</strong> </p>
<p><strong>Location / mode:</strong> </p>
<p><strong>Chair:</strong> </p>
<p><strong>Recorder:</strong> </p>
<h3>Attendees</h3>
<ul>
<li></li>
</ul>
<h3>Apologies</h3>
<ul>
<li></li>
</ul>
<h3>Agenda</h3>
<ol>
<li></li>
</ol>
<h3>Discussion</h3>
${blank}
<h3>Decisions</h3>
<ul>
<li></li>
</ul>
<h3>Action items</h3>
<ul>
<li><strong>Owner:</strong> — <strong>Due:</strong> — </li>
</ul>
<h3>Next meeting</h3>
<p><strong>Date:</strong> </p>`,
  },
  POLICY: {
    description: "Opens with purpose, scope, policy statements, and review cycle.",
    html: `<h2>Policy</h2>
<p><strong>Effective date:</strong> </p>
<p><strong>Owner:</strong> </p>
<p><strong>Review cycle:</strong> </p>
<h3>Purpose</h3>
${blank}
<h3>Scope</h3>
${blank}
<h3>Definitions</h3>
${blank}
<h3>Policy statements</h3>
<ol>
<li></li>
</ol>
<h3>Roles and responsibilities</h3>
${blank}
<h3>Procedures</h3>
${blank}
<h3>Related documents</h3>
<ul>
<li></li>
</ul>
<h3>Review and revision history</h3>
${blank}`,
  },
  BRIEF: {
    description: "Opens with situation, options, recommendation, and ask.",
    html: `<h2>Brief</h2>
<p><strong>Prepared for:</strong> </p>
<p><strong>Prepared by:</strong> </p>
<p><strong>Date:</strong> </p>
<p><strong>Subject:</strong> </p>
<h3>Situation</h3>
${blank}
<h3>Key points</h3>
<ul>
<li></li>
</ul>
<h3>Options</h3>
<ol>
<li></li>
</ol>
<h3>Recommendation</h3>
${blank}
<h3>Ask / decision needed</h3>
${blank}
<h3>Risks and implications</h3>
${blank}`,
  },
  FORM: {
    description: "Opens with purpose, instructions, and fill-in sections.",
    html: `<h2>Form</h2>
<p><strong>Form title:</strong> </p>
<p><strong>Version:</strong> </p>
<p><strong>Date submitted:</strong> </p>
<h3>Purpose</h3>
${blank}
<h3>Instructions</h3>
${blank}
<h3>Requester details</h3>
<p><strong>Name:</strong> </p>
<p><strong>Role / group:</strong> </p>
<p><strong>Contact:</strong> </p>
<h3>Request details</h3>
${blank}
<h3>Supporting information</h3>
${blank}
<h3>Approvals</h3>
<p><strong>Reviewed by:</strong> </p>
<p><strong>Approved by:</strong> </p>
<p><strong>Date:</strong> </p>`,
  },
  TOR: {
    description:
      "Terms of Reference — purpose, scope, responsibilities, and reporting. Use AI to suggest committee work from this document.",
    html: `<h2>Terms of Reference</h2>
<p><strong>Committee:</strong> </p>
<p><strong>Effective date:</strong> </p>
<p><strong>Approved by:</strong> </p>
<h3>Purpose</h3>
${blank}
<h3>Scope</h3>
${blank}
<h3>Membership</h3>
${blank}
<h3>Responsibilities</h3>
<ol>
<li></li>
</ol>
<h3>Authority and limits</h3>
${blank}
<h3>Meetings and quorum</h3>
${blank}
<h3>Reporting to governance</h3>
${blank}
<h3>Related documents</h3>
<ul>
<li></li>
</ul>
<h3>Review cycle</h3>
${blank}`,
  },
  OTHER: {
    description: "Opens with a simple title, purpose, and notes structure.",
    html: `<h2>Document</h2>
<p><strong>Date:</strong> </p>
<p><strong>Author:</strong> </p>
<h3>Purpose</h3>
${blank}
<h3>Notes</h3>
${blank}
<h3>Follow-up</h3>
<ul>
<li></li>
</ul>`,
  },
};

/** True when the client sent no real content (empty or blank paragraph). */
export function isEmptyDocumentBody(body: string | null | undefined): boolean {
  if (body == null) return true;
  const trimmed = body.trim();
  if (!trimmed) return true;
  return /^<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>$/i.test(trimmed);
}

export function getDocumentTemplateHtml(tag: LibraryDocumentTag): string {
  return DOCUMENT_TEMPLATES[tag]?.html ?? DOCUMENT_TEMPLATES.OTHER.html;
}
