import Groq from "groq-sdk";

let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export async function generateAgentDescription(
  name: string,
  capabilities: string[]
): Promise<string> {
  try {
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Write a clear, compelling 2-sentence description for an AI agent called "${name}" with capabilities: ${capabilities.join(", ")}. Be specific about what it does and who should use it. No marketing fluff.`
      }]
    });
    return response.choices[0].message.content ?? "";
  } catch {
    return "";
  }
}

export async function suggestAgentPrice(capabilities: string[], category: string): Promise<{
  pricePerCall: number;
  reasoning: string;
}> {
  try {
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 150,
      messages: [{
        role: "system",
        content: `You are a pricing advisor. Respond only in JSON: { "pricePerCall": number, "reasoning": string }`
      }, {
        role: "user",
        content: `Suggest a fair USDC price per API call for an AI agent in the ${category} category with capabilities: ${capabilities.join(", ")}. Simple tasks $0.0001-0.001, complex $0.001-0.01, specialized $0.01-0.1.`
      }]
    });
    const content = response.choices[0].message.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { pricePerCall: 0.001, reasoning: "Default pricing" };
  } catch {
    return { pricePerCall: 0.001, reasoning: "Default pricing" };
  }
}
