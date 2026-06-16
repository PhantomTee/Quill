import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const input = String(body.text ?? body.task ?? body.content ?? "").trim();
  const context = body.context ? `\n\nAdditional context: ${body.context}` : "";

  if (!input) return NextResponse.json({ error: "text or task is required" }, { status: 400 });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 300,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "You are a precise summarizer. Condense the given text into a clear, concise summary in 2-4 sentences. Preserve the key facts and conclusions. Output only the summary — no preamble, no labels.",
      },
      { role: "user", content: `${input}${context}` },
    ],
  });

  return NextResponse.json({ result: response.choices[0].message.content ?? "" });
}
