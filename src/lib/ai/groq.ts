const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

let lastRequestAt = 0;

function getMinInterval(): number {
  const raw = process.env.AI_MIN_REQUEST_INTERVAL_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 4500;
  return Number.isFinite(parsed) ? parsed : 4500;
}

function getMaxPromptChars(): number {
  const raw = process.env.AI_MAX_PROMPT_CHARS;
  const parsed = raw ? Number.parseInt(raw, 10) : 3500;
  return Number.isFinite(parsed) ? parsed : 3500;
}

async function throttle() {
  const minInterval = getMinInterval();
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < minInterval) {
    await new Promise((r) => setTimeout(r, minInterval - elapsed));
  }
  lastRequestAt = Date.now();
}

function requireApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return apiKey;
}

function getModel(): string {
  return process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = requireApiKey();
  await throttle();

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Empty response from Groq");
  }
  return content.trim();
}

async function callGroqJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = requireApiKey();
  await throttle();

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Groq");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }
}

function truncate(text: string): string {
  return text.slice(0, getMaxPromptChars());
}

export type TaskDraft = {
  title: string;
  description?: string;
};

export async function generateTaskDrafts(
  eventTitle: string,
  eventDescription: string,
): Promise<TaskDraft[]> {
  const description = truncate(eventDescription);

  const systemPrompt = `You are a church committee planning assistant. Given an event title and description, produce 4-8 broad, actionable parent tasks that a committee can assign to members. Each task should be concrete and achievable. Return ONLY valid JSON: an array of objects with "title" (string, required) and "description" (string, optional, one sentence). No markdown, no explanation.`;

  const userPrompt = `Event title: ${eventTitle}\n\nEvent description:\n${description || "(no description provided)"}\n\nRespond with JSON: { "tasks": [ { "title": "...", "description": "..." } ] }`;

  const parsed = await callGroqJson(systemPrompt, userPrompt);
  const tasks = extractTasks(parsed);
  if (tasks.length === 0) {
    throw new Error("AI returned no tasks");
  }

  return tasks.map((t) => ({
    title: t.title.trim(),
    description: t.description?.trim() || undefined,
  }));
}

export async function summarizeDocument(
  title: string,
  body: string,
): Promise<string> {
  const content = truncate(body);
  const systemPrompt = `You are a church governance document assistant. Summarize the document in 2-4 short paragraphs for committee leaders. Be factual and neutral. Do not invent content. Return plain text only — no markdown headings.`;
  return callGroq(
    systemPrompt,
    `Document title: ${title}\n\nDocument content:\n${content || "(empty)"}`,
  );
}

export type ReviewPoints = {
  risks: string[];
  actions: string[];
};

export async function extractReviewPoints(
  title: string,
  body: string,
): Promise<ReviewPoints> {
  const content = truncate(body);
  const systemPrompt = `You are a church document review assistant. Extract risks/concerns and concrete follow-up actions from the document. Return ONLY valid JSON: { "risks": string[], "actions": string[] }. Keep each item to one sentence. If none, return empty arrays. Never auto-approve or recommend approval.`;
  const parsed = await callGroqJson(
    systemPrompt,
    `Document title: ${title}\n\nDocument content:\n${content || "(empty)"}\n\nRespond with JSON: { "risks": [], "actions": [] }`,
  );

  if (!parsed || typeof parsed !== "object") {
    return { risks: [], actions: [] };
  }
  const obj = parsed as Record<string, unknown>;
  return {
    risks: Array.isArray(obj.risks)
      ? obj.risks.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [],
    actions: Array.isArray(obj.actions)
      ? obj.actions.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [],
  };
}

export async function answerDocumentQuestion(
  title: string,
  body: string,
  question: string,
): Promise<string> {
  const content = truncate(body);
  const systemPrompt = `You are a church document Q&A assistant. Answer only from the document content. If the answer is not in the document, say so clearly. Return plain text only. Never invent policies or approve anything.`;
  return callGroq(
    systemPrompt,
    `Document title: ${title}\n\nDocument content:\n${content || "(empty)"}\n\nQuestion: ${question.trim()}`,
  );
}

export type ProjectTaskBreakdownItem = {
  title: string;
  description?: string;
  estimatedDays?: number;
  dependsOnIndex?: number | null;
  onCriticalPath?: boolean;
};

export async function generateProjectTaskBreakdown(
  title: string,
  description: string,
  dueDate?: string | null,
): Promise<ProjectTaskBreakdownItem[]> {
  const desc = truncate(description);
  const systemPrompt = `You are a church project planning assistant using critical-path thinking (CPM). Given a project title, description, and optional due date, produce 5-10 sequenced tasks. Use dependsOnIndex (0-based index of a prior task, or null) for dependencies. Mark onCriticalPath true for tasks on the longest chain. estimatedDays is a positive number. Return ONLY valid JSON. Never auto-create or approve work.`;

  const userPrompt = `Project title: ${title}\n\nDescription:\n${desc || "(none)"}\n\nDue date: ${dueDate || "(none)"}\n\nRespond with JSON: { "tasks": [ { "title": "...", "description": "...", "estimatedDays": 2, "dependsOnIndex": null, "onCriticalPath": true } ] }`;

  const parsed = await callGroqJson(systemPrompt, userPrompt);
  const tasks = extractProjectTasks(parsed);
  if (tasks.length === 0) {
    throw new Error("AI returned no project tasks");
  }
  return tasks;
}

export async function generateAssistSuggestion(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  return callGroq(systemPrompt, truncate(userPrompt));
}

export async function generateAssistJson(
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown> {
  return callGroqJson(systemPrompt, truncate(userPrompt));
}

function extractTasks(parsed: unknown): TaskDraft[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isTaskDraft);
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.tasks)) {
      return obj.tasks.filter(isTaskDraft);
    }
    if (Array.isArray(obj.items)) {
      return obj.items.filter(isTaskDraft);
    }
  }
  return [];
}

function isTaskDraft(item: unknown): item is TaskDraft {
  return (
    !!item &&
    typeof item === "object" &&
    "title" in item &&
    typeof (item as TaskDraft).title === "string" &&
    (item as TaskDraft).title.trim().length > 0
  );
}

function extractProjectTasks(parsed: unknown): ProjectTaskBreakdownItem[] {
  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.tasks)) items = obj.tasks;
    else if (Array.isArray(obj.items)) items = obj.items;
  }

  return items
    .filter(isTaskDraft)
    .map((item, index, arr) => {
      const raw = item as Record<string, unknown>;
      const estimatedDays =
        typeof raw.estimatedDays === "number" && raw.estimatedDays > 0
          ? raw.estimatedDays
          : typeof raw.estimatedDays === "string"
            ? Number.parseFloat(raw.estimatedDays) || undefined
            : undefined;
      let dependsOnIndex: number | null = null;
      if (typeof raw.dependsOnIndex === "number" && Number.isInteger(raw.dependsOnIndex)) {
        if (raw.dependsOnIndex >= 0 && raw.dependsOnIndex < arr.length && raw.dependsOnIndex !== index) {
          dependsOnIndex = raw.dependsOnIndex;
        }
      }
      return {
        title: String(raw.title).trim(),
        description:
          typeof raw.description === "string" && raw.description.trim()
            ? raw.description.trim()
            : undefined,
        estimatedDays,
        dependsOnIndex,
        onCriticalPath: raw.onCriticalPath === true,
      };
    });
}
