"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addReminder, formatTime, loadReminders, removeReminder } from "@/lib/reminders";
import { isSttSupported, isTtsSupported, speak, startDictation, stopSpeaking } from "@/lib/voice";

type BotMessage = {
  role: "user" | "assistant";
  content: string;
};

type SupportedLang = "en" | "hi";

type ChatResponse = {
  reply: string;
  triage: {
    level: "emergency" | "urgent" | "self_care" | "unknown";
    reasons: string[];
  };
  actions?:
    | Array<{
        type: "set_reminder";
        label: string;
        hour: number;
        minute: number;
        repeat: "daily" | "once";
      }>
    | undefined;
};

const STARTER: BotMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I’m ElderCare MediBot. Tell me what you’re feeling, and I’ll help you decide next steps.\n\nIf you think this is an emergency, call your local emergency number now.",
  },
];

const I18N: Record<SupportedLang, { starter: string; placeholder: string }> = {
  en: {
    starter:
      "Hi, I’m ElderCare MediBot. Tell me what you’re feeling, and I’ll help you decide next steps.\n\nIf you think this is an emergency, call your local emergency number now.",
    placeholder: "Example: I have chest pain and feel short of breath",
  },
  hi: {
    starter:
      "नमस्ते, मैं ElderCare MediBot हूँ। आप कैसा महसूस कर रहे हैं बताइए—मैं अगला सुरक्षित कदम तय करने में मदद करूँगा।\n\nअगर यह आपातकाल लगता है, तुरंत स्थानीय आपातकालीन नंबर (जैसे 112/108) पर कॉल करें।",
    placeholder: "उदाहरण: मुझे छाती में दर्द है और सांस लेने में तकलीफ है",
  },
};

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function levelBadge(level: ChatResponse["triage"]["level"]) {
  switch (level) {
    case "emergency":
      return "Emergency";
    case "urgent":
      return "Urgent";
    case "self_care":
      return "Self-care";
    default:
      return "";
  }
}

export default function HomePage() {
  const [lang, setLang] = useState<SupportedLang>("en");
  const [messages, setMessages] = useState<BotMessage[]>(STARTER);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [triageLevel, setTriageLevel] = useState<ChatResponse["triage"]["level"]>(
    "self_care",
  );

  const [reminders, setReminders] = useState(() => loadReminders());

  const [caregiverName, setCaregiverName] = useState("My caregiver");
  const [caregiverTo, setCaregiverTo] = useState("");
  const [caregiverChannel, setCaregiverChannel] = useState<"sms" | "whatsapp">("sms");
  const [escalatePending, setEscalatePending] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [autoRead, setAutoRead] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const badge = useMemo(() => levelBadge(triageLevel), [triageLevel]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const nextMessages = [...messages, { role: "user", content: text } as const];
    setMessages(nextMessages);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = (await res.json()) as ChatResponse | { error?: string };
      if (!res.ok) {
        const msg =
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Request failed";
        throw new Error(msg);
      }

      const ok = data as ChatResponse;
      setTriageLevel(ok.triage?.level ?? "self_care");
      setMessages((m) => [...m, { role: "assistant", content: ok.reply }]);

      if (autoRead && isTtsSupported()) {
        const langTag = lang === "hi" ? "hi-IN" : "en-US";
        speak(ok.reply, { lang: langTag, rate: 0.95 });
      }

      // Apply structured actions (e.g., set reminder)
      const acts = ok.actions ?? [];
      for (const a of acts) {
        if (a.type === "set_reminder") {
          setReminders((prev) =>
            addReminder(prev, {
              label: a.label,
              hour: a.hour,
              minute: a.minute,
              repeat: a.repeat,
            }),
          );
        }
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry — something went wrong. Please try again. If this feels urgent, contact a clinician or emergency services.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function startVoiceInput() {
    if (!isSttSupported()) {
      alert("Voice input is not supported in this browser.");
      return;
    }
    setDictating(true);
    startDictation({
      onText: (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
      onError: () => {
        setDictating(false);
        alert("Voice input failed. Please try again or type.");
      },
      onEnd: () => setDictating(false),
    });
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") {
      alert("Notifications are not supported in this browser.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      alert("Notifications were not enabled. Reminders will still appear in your list.");
    }
  }

  async function sendCaregiverMessage() {
    if (!caregiverTo.trim()) {
      alert("Please enter a caregiver phone number.");
      return;
    }
    setEscalatePending(true);
    try {
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const lastAssistant =
        [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

      const text = [
        "ElderCare MediBot alert:",
        lastUser ? `User said: ${lastUser}` : "",
        lastAssistant ? `Bot guidance: ${lastAssistant}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/escalate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caregiverName,
          to: caregiverTo,
          channel: caregiverChannel,
          message: text,
        }),
      });

      const data = (await res.json()) as { mode?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send");

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            data.mode === "twilio"
              ? "Okay — I sent a message to your caregiver."
              : "Demo mode: caregiver message prepared (Twilio not configured).",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "I couldn’t send the caregiver message. You may need to call them directly. If urgent, call emergency services.",
        },
      ]);
    } finally {
      setEscalatePending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ElderCare MediBot</h1>
            <p className="text-sm text-zinc-600">
              Senior-friendly medical guidance • Not a substitute for professional care
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="lang">
              Language
            </label>
            <select
              id="lang"
              value={lang}
              onChange={(e) => setLang(e.target.value as SupportedLang)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              title="Language"
              aria-label="Language"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>

            <div
              className={classNames(
                "rounded-full px-3 py-1 text-sm font-medium",
                triageLevel === "emergency" && "bg-red-100 text-red-800",
                triageLevel === "urgent" && "bg-amber-100 text-amber-900",
                triageLevel === "self_care" && "bg-emerald-100 text-emerald-900",
              )}
              aria-label="Triage level"
              title="Triage level"
            >
              {badge}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-zinc-200 bg-white">
            <div
              ref={listRef}
              className="h-[62vh] overflow-y-auto p-4 md:h-[70vh]"
              aria-label="Chat messages"
            >
              <div className="space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={classNames(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={classNames(
                        "max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-base leading-7 md:text-lg",
                        m.role === "user"
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-900",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {pending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-base leading-7 md:text-lg">
                      Typing…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-200 p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-end gap-2"
              >
                <label className="sr-only" htmlFor="message">
                  Message
                </label>
                <textarea
                  id="message"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-base leading-7 focus:outline-none focus:ring-2 focus:ring-zinc-900 md:text-lg"
                  placeholder={I18N[lang].placeholder}
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => startVoiceInput()}
                    disabled={pending || dictating}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
                    title="Voice input"
                    aria-label="Voice input"
                  >
                    {dictating ? "Listening…" : "Voice"}
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50 md:text-lg"
                  >
                    Send
                  </button>
                </div>
              </form>
              <div className="mt-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={autoRead}
                    onChange={(e) => setAutoRead(e.target.checked)}
                  />
                  Read replies aloud
                </label>
                <button
                  type="button"
                  onClick={() => stopSpeaking()}
                  disabled={!isTtsSupported()}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                >
                  Stop audio
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Emergency shortcut</h2>
              <p className="mt-2 text-base leading-7 text-zinc-700">
                If you have chest pain, trouble breathing, signs of stroke, severe bleeding, or you
                feel in danger, call your local emergency number now.
              </p>
              <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
                Tip: You can say “I’m alone” and your city/country, so I can guide what to do while
                you wait for help.
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Try these</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {["I fell and hit my head", "My blood sugar is very low", "I missed my medicine dose"].map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInput(t)}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Medication reminders</h2>
                <button
                  type="button"
                  onClick={() => void requestNotifications()}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Enable notifications
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                Tip: Say “Remind me to take metformin at 8pm every day”. Reminders are stored on this
                device.
              </p>

              <div className="mt-3 space-y-2">
                {reminders.length === 0 ? (
                  <div className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
                    No reminders yet.
                  </div>
                ) : (
                  reminders.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.label}</div>
                        <div className="text-xs text-zinc-600">
                          {formatTime(r.hour, r.minute)} • {r.repeat}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReminders((prev) => removeReminder(prev, r.id))}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Caregiver escalation</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                Configure a caregiver number. When needed, press “Message caregiver”.
              </p>

              <div className="mt-3 space-y-2">
                <label className="block text-xs font-medium text-zinc-700">
                  Caregiver name
                  <input
                    value={caregiverName}
                    onChange={(e) => setCaregiverName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="My caregiver"
                  />
                </label>

                <label className="block text-xs font-medium text-zinc-700">
                  Phone number (E.164 recommended)
                  <input
                    value={caregiverTo}
                    onChange={(e) => setCaregiverTo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="+15551234567"
                  />
                </label>

                <label className="block text-xs font-medium text-zinc-700">
                  Channel
                  <select
                    value={caregiverChannel}
                    onChange={(e) =>
                      setCaregiverChannel(e.target.value === "whatsapp" ? "whatsapp" : "sms")
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp (Twilio Sandbox/approved)</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => void sendCaregiverMessage()}
                  disabled={escalatePending}
                  className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {escalatePending ? "Sending…" : "Message caregiver"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
