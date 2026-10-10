import { NextResponse } from "next/server";
import { generateReply, type BotMessage } from "@/lib/bot";

type ChatRequest = {
  messages: BotMessage[];
};

export async function POST(req: Request) {
  let body: ChatRequest | null = null;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body?.messages;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }

  const result = await generateReply(messages);
  return NextResponse.json(result);
}
