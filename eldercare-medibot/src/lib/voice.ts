export type SpeakOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
};

export function isTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isSttSupported() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (!isTtsSupported()) return;
  const utter = new SpeechSynthesisUtterance(text);
  if (opts.lang) utter.lang = opts.lang;
  if (typeof opts.rate === "number") utter.rate = opts.rate;
  if (typeof opts.pitch === "number") utter.pitch = opts.pitch;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}

export type DictationCallbacks = {
  onText: (text: string) => void;
  onError?: (err: unknown) => void;
  onEnd?: () => void;
};

export function startDictation({ onText, onError, onEnd }: DictationCallbacks) {
  if (!isSttSupported()) {
    onError?.(new Error("Speech recognition not supported"));
    return null;
  }

  type EventLike = { results?: Array<Array<{ transcript?: string }>> };
  type RecLike = {
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: EventLike) => void) | null;
    onerror: ((err: unknown) => void) | null;
    onend: (() => void) | null;
    start: () => void;
  };
  type Ctor = new () => RecLike;

  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = false;
  rec.onresult = (event: EventLike) => {
    const transcript = event?.results?.[0]?.[0]?.transcript;
    if (typeof transcript === "string") onText(transcript);
  };
  rec.onerror = (e: unknown) => onError?.(e);
  rec.onend = () => onEnd?.();
  rec.start();
  return rec;
}
