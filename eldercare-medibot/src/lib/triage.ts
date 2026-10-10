export type TriageLevel = "emergency" | "urgent" | "self_care" | "unknown";

export type TriageResult = {
  level: TriageLevel;
  reasons: string[];
  immediateActions: string[];
  suggestedQuestions: string[];
};

const EMERGENCY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /chest pain|pressure in (my|the) chest/i, reason: "Possible heart-related chest pain" },
  { re: /short(ness)? of breath|can'?t breathe|trouble breathing/i, reason: "Breathing difficulty" },
  { re: /stroke|face droop|arm weakness|slurred speech|FAST/i, reason: "Possible stroke symptoms" },
  { re: /fainted|passed out|unconscious/i, reason: "Loss of consciousness" },
  { re: /severe bleeding|won'?t stop bleeding|vomiting blood|coughing blood/i, reason: "Severe bleeding" },
  { re: /suicid(e|al)|kill myself|hurt myself/i, reason: "Self-harm risk" },
  { re: /anaphylaxis|swelling (of )?(lips|tongue)|hives.*trouble breathing/i, reason: "Severe allergic reaction" },
];

const URGENT_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /fever (above|over) (102|103)|high fever/i, reason: "High fever" },
  { re: /new confusion|confused suddenly|delirium/i, reason: "Acute confusion" },
  { re: /fall(ed)? and (hit|hurt) (my )?head|head injury/i, reason: "Fall with possible head injury" },
  { re: /severe pain|worst pain/i, reason: "Severe pain" },
  { re: /blood sugar (very )?(low|high)|hypoglyc(e|a)mia|hyperglyc(e|a)mia/i, reason: "Concerning blood sugar" },
];

export function triageFromText(text: string): TriageResult {
  const t = text.trim();
  const reasons: string[] = [];

  for (const p of EMERGENCY_PATTERNS) {
    if (p.re.test(t)) reasons.push(p.reason);
  }
  if (reasons.length) {
    return {
      level: "emergency",
      reasons,
      immediateActions: [
        "Call your local emergency number now (e.g., 911/112).",
        "If you are alone, unlock the door if possible and put your phone on speaker.",
        "If symptoms started suddenly (stroke/heart), note the time they began.",
      ],
      suggestedQuestions: [
        "Where are you located (city/country)?",
        "Are you alone right now?",
        "Do you have chest pain, trouble breathing, severe bleeding, or weakness on one side?",
      ],
    };
  }

  for (const p of URGENT_PATTERNS) {
    if (p.re.test(t)) reasons.push(p.reason);
  }
  if (reasons.length) {
    return {
      level: "urgent",
      reasons,
      immediateActions: [
        "If symptoms are getting worse or you feel unsafe, seek urgent care or call emergency services.",
        "If possible, contact a caregiver/family member to stay with you.",
      ],
      suggestedQuestions: [
        "How old are you and what medical conditions do you have (heart disease, diabetes, COPD, etc.)?",
        "What medicines are you taking and when was your last dose?",
        "How long have you had these symptoms?",
      ],
    };
  }

  return {
    level: "self_care",
    reasons: [],
    immediateActions: [
      "I can help with safe self-care tips and deciding whether you should contact a clinician.",
      "If you feel very unwell, have severe symptoms, or your intuition says this is urgent, seek medical care.",
    ],
    suggestedQuestions: [
      "What symptoms are you having and when did they start?",
      "What is your age and do you have any chronic conditions?",
      "Do you have a thermometer/blood pressure cuff/oximeter reading?",
    ],
  };
}
