import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const input = String(body.text ?? body.task ?? body.content ?? "").trim();
  const targetLanguage = String(body.targetLanguage ?? body.language ?? body.target ?? "English").trim();
  const context = body.context ? `\n\nContext: ${body.context}` : "";

  if (!input) return NextResponse.json({ error: "text or task is required" }, { status: 400 });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 400,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the given text to ${targetLanguage}. Respond ONLY with JSON:
{"translation":"<translated text>","detectedLanguage":"<source language name>"}`,
      },
      { role: "user", content: `${input}${context}` },
    ],
  });

  const raw = response.choices[0].message.content ?? "{}";
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      translation: string; detectedLanguage: string;
    };
    return NextResponse.json({
      result: parsed.translation,
      translation: parsed.translation,
      detectedLanguage: parsed.detectedLanguage,
      targetLanguage,
    });
  } catch {
    return NextResponse.json({ result: raw });
  }
}
