import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const input = String(body.text ?? body.task ?? body.content ?? "").trim();
  const context = body.context ? `\n\nContext: ${body.context}` : "";

  if (!input) return NextResponse.json({ error: "text or task is required" }, { status: 400 });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 200,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `Analyze the sentiment of the text. Respond ONLY with JSON:
{"sentiment":"positive"|"negative"|"neutral","score":0.0-1.0,"reasoning":"one sentence"}`,
      },
      { role: "user", content: `${input}${context}` },
    ],
  });

  const raw = response.choices[0].message.content ?? "{}";
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      sentiment: string; score: number; reasoning: string;
    };
    const result = `${parsed.sentiment} (${(parsed.score * 100).toFixed(0)}% confidence): ${parsed.reasoning}`;
    return NextResponse.json({ result, sentiment: parsed.sentiment, score: parsed.score, reasoning: parsed.reasoning });
  } catch {
    return NextResponse.json({ result: raw });
  }
}
