export type Reminder = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  repeat: "daily" | "once";
  createdAt: number;
};

const STORAGE_KEY = "eldercare_medibot_reminders_v1";

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function loadReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  const data = safeJsonParse<Reminder[]>(window.localStorage.getItem(STORAGE_KEY));
  return Array.isArray(data) ? data : [];
}

export function saveReminders(reminders: Reminder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function addReminder(reminders: Reminder[], r: Omit<Reminder, "id" | "createdAt">): Reminder[] {
  const id = crypto.randomUUID();
  const next: Reminder = { ...r, id, createdAt: Date.now() };
  const updated = [next, ...reminders];
  saveReminders(updated);
  return updated;
}

export function removeReminder(reminders: Reminder[], id: string): Reminder[] {
  const updated = reminders.filter((r) => r.id !== id);
  saveReminders(updated);
  return updated;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function nextOccurrenceMs(hour: number, minute: number) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/**
 * In-browser demo scheduler using setTimeout.
 * Note: this won't fire if the tab/device is asleep or the page is closed.
 */
export function scheduleBrowserReminder(reminder: Reminder, onFire?: () => void): number | null {
  if (typeof window === "undefined") return null;
  const delay = nextOccurrenceMs(reminder.hour, reminder.minute);
  const id = window.setTimeout(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Medication reminder", {
        body: `Time to: ${reminder.label}`,
      });
    }
    onFire?.();
  }, delay);
  return id;
}
