import { NextResponse } from "next/server";
import type { CareChannel } from "@/lib/actions";

type EscalateRequest = {
  caregiverName: string;
  to: string;
  channel: CareChannel;
  message: string;
};

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function base64BasicAuth(user: string, pass: string) {
  const raw = `${user}:${pass}`;
  const g = globalThis as unknown as { btoa?: (s: string) => string };
  const btoaFn = g.btoa;
  if (btoaFn) return btoaFn(raw);
  // Fallback (node)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require("buffer");
  return Buffer.from(raw, "utf8").toString("base64");
}

function formatTo(channel: CareChannel, to: string) {
  return channel === "whatsapp" ? `whatsapp:${to}` : to;
}

function formatFrom(channel: CareChannel, from: string) {
  return channel === "whatsapp" ? `whatsapp:${from}` : from;
}

export async function POST(req: Request) {
  let body: EscalateRequest | null = null;
  try {
    body = (await req.json()) as EscalateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const caregiverName = body?.caregiverName?.trim();
  const to = body?.to?.trim();
  const channel = body?.channel;
  const message = body?.message?.trim();

  if (!caregiverName || !to || !message || (channel !== "sms" && channel !== "whatsapp")) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Optional Twilio integration. If env vars are missing, we return a demo payload.
  const accountSid = getEnv("TWILIO_ACCOUNT_SID");
  const authToken = getEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = getEnv("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({
      mode: "demo",
      caregiverName,
      channel,
      to,
      wouldSend: message,
      hint:
        "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to send real SMS/WhatsApp via Twilio.",
    });
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", formatTo(channel, to));
  form.set("From", formatFrom(channel, fromNumber));
  form.set("Body", message);

  const auth = base64BasicAuth(accountSid, authToken);
  const twilioRes = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: form.toString(),
  });

  if (!twilioRes.ok) {
    const errText = await twilioRes.text();
    return NextResponse.json(
      { error: "Failed to send message", details: errText.slice(0, 8000) },
      { status: 502 },
    );
  }

  const data = (await twilioRes.json()) as { sid?: string };
  return NextResponse.json({ mode: "twilio", sid: data?.sid });
}
