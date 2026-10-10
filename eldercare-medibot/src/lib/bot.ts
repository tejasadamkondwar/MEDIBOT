import { triageFromText, type TriageResult } from "@/lib/triage";
import { extractReminderAction, type BotAction } from "@/lib/actions";
import { llmReply } from "@/lib/llm";

export type BotMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BotReply = {
  reply: string;
  triage: TriageResult;
  actions?: BotAction[];
};

function formatTriageBanner(triage: TriageResult): string {
  if (triage.level === "emergency") {
    return [
      "EMERGENCY: Please call your local emergency number now (e.g., 911/112).",
      triage.reasons.length ? `Why I think this may be an emergency: ${triage.reasons.join(", ")}.` : "",
      "If you can, tell me: where you are located and whether you are alone.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (triage.level === "urgent") {
    return [
      "This may be URGENT.",
      triage.reasons.length ? `Reason(s): ${triage.reasons.join(", ")}.` : "",
      "If you feel unsafe or symptoms are worsening, seek urgent care or call emergency services.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function generalSafetyDisclaimer(): string {
  return [
    "I’m not a doctor, but I can help you decide next steps and provide general safety information.",
    "If you think this is an emergency, call your local emergency number now.",
  ].join(" ");
}

function buildSeniorFriendlyQuestions(triage: TriageResult): string {
  const qs = triage.suggestedQuestions;
  if (!qs.length) return "";
  return ["\nQuestions (you can answer in short):", ...qs.map((q, i) => `${i + 1}) ${q}`)].join(
    "\n",
  );
}

export async function generateReply(history: BotMessage[]): Promise<BotReply> {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  const triage = triageFromText(userText);

  const actions: BotAction[] = [];
  const reminder = extractReminderAction(userText);
  if (reminder) actions.push(reminder);

  const banner = formatTriageBanner(triage);
  const questions = buildSeniorFriendlyQuestions(triage);

  // Simple, non-LLM response logic (offline demo). This can be swapped for an LLM later.
  let replyBody = "";
  if (triage.level === "emergency") {
    replyBody = [
      banner,
      "\nImmediate steps:",
      ...triage.immediateActions.map((a) => `- ${a}`),
      questions,
    ]
      .filter(Boolean)
      .join("\n");
  } else if (triage.level === "urgent") {
    replyBody = [
      banner,
      "\nWhat you can do now:",
      ...triage.immediateActions.map((a) => `- ${a}`),
      questions,
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    // Prefer an LLM response if configured.
    const llm = await llmReply(history);
    if (llm) {
      replyBody = [generalSafetyDisclaimer(), "\n", llm, questions].filter(Boolean).join("\n");
    } else {
      replyBody = [
        generalSafetyDisclaimer(),
        "Tell me what’s going on and I’ll guide you step-by-step.",
        questions,
        "\nYou can also ask me:",
        "- ‘Remind me to take metformin at 8pm every day’",
        "- ‘I missed my medicine dose’ (general guidance)",
        "- ‘I fell down’ (safety checks)",
        "- ‘Message my caregiver’ (demo escalation)",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (reminder) {
      replyBody +=
        `\n\nOkay — I’ll set a reminder for “${reminder.label}” at ${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")} (${reminder.repeat}). ` +
        "If notifications are disabled, I’ll still keep it in your reminders list.";
    }
  }

  return { reply: replyBody, triage, actions: actions.length ? actions : undefined };
}
