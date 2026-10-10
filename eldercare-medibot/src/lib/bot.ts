import { triageFromText, type TriageResult } from "@/lib/triage";

export type BotMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BotReply = {
  reply: string;
  triage: TriageResult;
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

export function generateReply(history: BotMessage[]): BotReply {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  const triage = triageFromText(userText);

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
    replyBody = [
      generalSafetyDisclaimer(),
      "Tell me what’s going on and I’ll guide you step-by-step.",
      questions,
      "\nYou can also ask me:",
      "- ‘Set a medication reminder’ (demo)",
      "- ‘What should I do if I missed a dose?’ (general guidance)",
      "- ‘I fell down’ (safety checks)",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return { reply: replyBody, triage };
}
