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

export type TaskDraft = {
  title: string;
  description?: string;
};

export async function generateTaskDrafts(
  eventTitle: string,
  eventDescription: string,
): Promise<TaskDraft[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
  const maxChars = getMaxPromptChars();
  const description = eventDescription.slice(0, maxChars);

  await throttle();

  const systemPrompt = `You are a church committee planning assistant. Given an event title and description, produce 4-8 broad, actionable parent tasks that a committee can assign to members. Each task should be concrete and achievable. Return ONLY valid JSON: an array of objects with "title" (string, required) and "description" (string, optional, one sentence). No markdown, no explanation.`;

  const userPrompt = `Event title: ${eventTitle}\n\nEvent description:\n${description || "(no description provided)"}`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nRespond with JSON: { "tasks": [ { "title": "...", "description": "..." } ] }`,
        },
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }

  const tasks = extractTasks(parsed);
  if (tasks.length === 0) {
    throw new Error("AI returned no tasks");
  }

  return tasks.map((t) => ({
    title: t.title.trim(),
    description: t.description?.trim() || undefined,
  }));
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
