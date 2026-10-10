export type CareChannel = "sms" | "whatsapp";

export type SetReminderAction = {
  type: "set_reminder";
  /** User-friendly label e.g., "Metformin" */
  label: string;
  /** Local time components (interpreted on the client in the user's timezone) */
  hour: number;
  minute: number;
  repeat: "daily" | "once";
};

export type BotAction = SetReminderAction;

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Very small time parser for phrases like:
 * - "at 8pm"
 * - "at 8:30 pm"
 * - "at 20:30"
 */
export function parseTimeFromText(text: string): { hour: number; minute: number } | null {
  const t = text.toLowerCase();

  // 24h e.g. 20:30
  const m24 = t.match(/\b(?:at\s*)?(\d{1,2}):(\d{2})\b/);
  if (m24) {
    const hour = clampInt(Number(m24[1]), 0, 23);
    const minute = clampInt(Number(m24[2]), 0, 59);
    return { hour, minute };
  }

  // 12h e.g. 8pm / 8:30 pm
  const m12 = t.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m12) {
    let hour = clampInt(Number(m12[1]), 1, 12);
    const minute = clampInt(Number(m12[2] ?? "0"), 0, 59);
    const ampm = m12[3];
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  return null;
}

/**
 * Extract a reminder intent from a single user message.
 * Example: "Remind me to take metformin at 8pm every day"
 */
export function extractReminderAction(userText: string): SetReminderAction | null {
  const t = userText.trim();
  if (!/\b(remind|reminder)\b/i.test(t)) return null;

  const time = parseTimeFromText(t);
  if (!time) return null;

  const repeat: SetReminderAction["repeat"] = /\b(daily|every day|everyday)\b/i.test(t)
    ? "daily"
    : "once";

  // Try to capture medication/task label.
  // e.g. "remind me to take metformin at 8pm"
  // e.g. "set a reminder for blood pressure pill at 7:30 am"
  const labelMatch = t.match(
    /\b(?:remind me to|set (?:a )?reminder(?: for)?|reminder(?: for)?)\s+(.+?)\s+\b(?:at)\b/i,
  );
  const rawLabel = labelMatch?.[1]?.trim() ?? "your medication";
  const label = rawLabel.replace(/\b(take|to take)\b\s*/i, "").trim() || "your medication";

  return {
    type: "set_reminder",
    label,
    hour: time.hour,
    minute: time.minute,
    repeat,
  };
}
