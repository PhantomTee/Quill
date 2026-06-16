import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const question = String(body.question ?? body.task ?? body.text ?? "").trim();
  const context = body.context ? String(body.context) : null;

  if (!question) return NextResponse.json({ error: "question or task is required" }, { status: 400 });

  const userContent = context
    ? `Context:\n${context}\n\nQuestion: ${question}`
    : question;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 500,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "You are a precise question-answering agent. Answer clearly and directly. If context is provided, base your answer on it. If not, use your knowledge. Be concise but complete.",
      },
      { role: "user", content: userContent },
    ],
  });

  return NextResponse.json({ result: response.choices[0].message.content ?? "" });
}
