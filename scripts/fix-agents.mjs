// Fix service_url (localhost → production) on-chain + upsert to Supabase
// Usage: node --env-file=.env.local scripts/fix-agents.mjs

import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "0x7d55995c09a8fdc2c93b8d9bc1a8b1511739ba46";
const PROD_URL = "https://quill-arc.vercel.app";
const SELLER_ADDRESS = process.env.NEXT_PUBLIC_SELLER_ADDRESS;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REGISTRY_ABI = parseAbi([
  "function updateAgent(uint256 agentId, string serviceUrl, uint256 pricePerCall, string description)",
]);

const AGENTS = [
  { id: 1, name: "Text Summarizer",   path: "/api/workers/summarize", price: 500n,  tags: ["summarizer","nlp","text"],          description: "Condenses any text into a clear 2-4 sentence summary. Handles articles, documents, and long-form content. Returns the core meaning fast." },
  { id: 2, name: "Keyword Extractor", path: "/api/workers/keywords",  price: 300n,  tags: ["keywords","extraction","nlp"],       description: "Pulls the top keywords and key phrases from any text. Returns a comma-separated list ranked by importance. Useful for tagging and search indexing." },
  { id: 3, name: "Sentiment Analyzer",path: "/api/workers/sentiment", price: 300n,  tags: ["sentiment","analysis","nlp"],        description: "Classifies text as positive, negative, or neutral with a confidence score and one-sentence reasoning. Built for reviews, feedback, and social content." },
  { id: 4, name: "Q&A Agent",         path: "/api/workers/qa",        price: 800n,  tags: ["qa","question","reasoning"],         description: "Answers questions directly and precisely. Accepts optional context to ground answers in your data. Handles factual, analytical, and open-ended questions." },
  { id: 5, name: "Translator",        path: "/api/workers/translate",  price: 500n,  tags: ["translate","language","multilingual"],description: "Translates text into any target language. Auto-detects the source language and returns the translation with detected language metadata." },
];

const account = privateKeyToAccount(DEPLOYER_KEY);
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC) });
const publicClient  = createPublicClient({ chain: arcTestnet, transport: http(RPC) });

async function supabaseUpsert(agent, serviceUrl) {
  // PATCH updates the existing row matched by agent_id
  const res = await fetch(`${SUPABASE_URL}/rest/v1/agents?agent_id=eq.${agent.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      name: agent.name,
      description: agent.description,
      service_url: serviceUrl,
      price_per_call: Number(agent.price),
      tags: agent.tags,
      is_active: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`  Supabase failed: ${err}`);
  } else {
    console.log(`  Supabase OK`);
  }
}

for (const agent of AGENTS) {
  const serviceUrl = `${PROD_URL}${agent.path}`;
  console.log(`\nFixing agent ${agent.id}: ${agent.name}`);
  console.log(`  serviceUrl: ${serviceUrl}`);

  const hash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "updateAgent",
    args: [BigInt(agent.id), serviceUrl, agent.price, agent.description],
  });
  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  confirmed block ${receipt.blockNumber}`);

  await supabaseUpsert(agent, serviceUrl);
}

console.log("\nAll agents fixed.");
