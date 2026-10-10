"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BotMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  triage: {
    level: "emergency" | "urgent" | "self_care" | "unknown";
    reasons: string[];
  };
};

const STARTER: BotMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I’m ElderCare MediBot. Tell me what you’re feeling, and I’ll help you decide next steps.\n\nIf you think this is an emergency, call your local emergency number now.",
  },
];

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
  const [messages, setMessages] = useState<BotMessage[]>(STARTER);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [triageLevel, setTriageLevel] = useState<ChatResponse["triage"]["level"]>(
    "self_care",
  );

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
                  placeholder="Example: I have chest pain and feel short of breath"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50 md:text-lg"
                >
                  Send
                </button>
              </form>
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
          </aside>
        </div>
      </main>
    </div>
  );
}
