import type { BotMessage } from "@/lib/bot";

function getEnv(name: string): string | undefined {
  // Next.js route handlers can inline env vars at build time.
  // Keep access centralized.
  return process.env[name];
}

function normalizeMessages(history: BotMessage[]) {
  // OpenAI expects {role, content} with roles: system/user/assistant.
  // We'll map our roles; we will add our own system message.
  return history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function llmReply(history: BotMessage[]): Promise<string | null> {
  const provider = (getEnv("LLM_PROVIDER") ?? "").toLowerCase();
  if (provider && provider !== "openai") return null;

  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = getEnv("OPENAI_MODEL") || "gpt-4o-mini";

  const system =
    "You are ElderCare MediBot, a senior-friendly medical help assistant. " +
    "Use simple language, short steps, and ask clarifying questions. " +
    "Do NOT claim to be a doctor. Never provide definitive diagnosis. " +
    "If the user might be in danger, advise calling local emergency services. " +
    "When suggesting actions, be conservative and safety-first.";

  const payload = {
    model,
    messages: [{ role: "system", content: system }, ...normalizeMessages(history)],
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}
