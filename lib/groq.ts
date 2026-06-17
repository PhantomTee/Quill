import Groq from "groq-sdk";

let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

function extractJson<T>(content: string): T {
  const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON found in LLM output: ${content}`);
  return JSON.parse(match[0]) as T;
}

export interface Subtask {
  capability: string;
  searchQuery: string;
  tags: string[];
}

export interface AgentCandidate {
  agentId: number;
  name: string;
  description: string | null;
  priceFormatted: string;
  tags: string[];
  totalCalls: number;
}

export interface EvaluationResult {
  chosenAgentId: number | null;
  reasoning: string;
  confidence: number;
}

export interface SubtaskResult {
  subtask: Subtask;
  output: string;
  agentId: number | null;
  agentName: string | null;
}

export async function planTask(task: string): Promise<Subtask[]> {
  const groq = getGroq();
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You decompose user tasks into ordered subtasks for an AI agent marketplace. Each subtask is fulfilled by a specialized AI agent that charges per call.

Respond ONLY with a JSON array — no prose, no markdown fences:
[
  { "capability": "what this subtask needs", "searchQuery": "search terms to find the right agent", "tags": ["tag1","tag2"] }
]

Rules:
- 1-4 subtasks maximum; avoid splitting unnecessarily.
- searchQuery should be 3-6 words that describe the agent capability needed.
- tags must be lowercase single-word strings.`
      },
      {
        role: "user",
        content: `Decompose this task into subtasks: "${task}"`
      }
    ]
  });
  const content = response.choices[0].message.content ?? "[]";
  return extractJson<Subtask[]>(content);
}

export async function evaluateCandidates(
  subtask: Subtask,
  candidates: AgentCandidate[],
  remainingBudgetUSDC: string
): Promise<EvaluationResult> {
  const groq = getGroq();

  if (candidates.length === 0) {
    return { chosenAgentId: null, reasoning: "No agents found for this capability.", confidence: 1 };
  }

  // Sanitize agent-supplied fields before injecting into LLM prompt to prevent injection attacks
  const sanitize = (s: string, maxLen = 120) =>
    s.replace(/[<>\[\]{}\\]/g, "").replace(/\n/g, " ").slice(0, maxLen);

  const candidateList = candidates.map(c =>
    `ID ${c.agentId}: "${sanitize(c.name, 60)}" — ${sanitize(c.description ?? "no description")} | price: $${c.priceFormatted} USDC | tags: [${c.tags.map(t => sanitize(t, 20)).join(", ")}] | totalCalls: ${c.totalCalls}`
  ).join("\n");

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 400,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are a cost-conscious AI buyer agent. Your job is to select the best agent for a subtask, or decline if none is worth the cost.

Respond ONLY with JSON (no prose, no markdown):
{ "chosenAgentId": <number or null>, "reasoning": "<must mention cost vs value>", "confidence": <0.0-1.0> }

Rules:
- Set chosenAgentId to null if no candidate is worth paying for (poor description, irrelevant, or budget too tight).
- Prefer agents with higher totalCalls (proven track record).
- Reason must explicitly compare the price against the expected value delivered.
- confidence reflects how certain you are this agent will fulfill the subtask.`
      },
      {
        role: "user",
        content: `Subtask: "${subtask.capability}"
Remaining budget: $${remainingBudgetUSDC} USDC

Candidates:
${candidateList}

Choose the best agent or return null if nothing is worth the cost.`
      }
    ]
  });

  const content = response.choices[0].message.content ?? "{}";
  return extractJson<EvaluationResult>(content);
}

export async function synthesize(task: string, subtaskResults: SubtaskResult[]): Promise<string> {
  const groq = getGroq();

  const resultsSummary = subtaskResults.map((r, i) =>
    `Step ${i + 1} (${r.subtask.capability})${r.agentName ? ` — handled by "${r.agentName}"` : " — skipped"}:\n${r.output || "(no output)"}`
  ).join("\n\n");

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 800,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "You synthesize outputs from multiple AI agents into a coherent final answer for the user. Be concise and direct."
      },
      {
        role: "user",
        content: `Original task: "${task}"

Agent outputs:
${resultsSummary}

Produce a single, well-structured final answer.`
      }
    ]
  });

  return response.choices[0].message.content ?? "";
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
