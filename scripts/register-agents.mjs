// Register 5 built-in Quill agents on-chain and upsert to Supabase
// Usage: node --env-file=.env.local scripts/register-agents.mjs

import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const REGISTRY_ADDRESS = "0x2953d5aa9409201d6e6ddef78fec0be056810bf2";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quill-app-liard.vercel.app").replace(/\/$/, "");
const SELLER_ADDRESS = process.env.NEXT_PUBLIC_SELLER_ADDRESS;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DEPLOYER_KEY) { console.error("DEPLOYER_PRIVATE_KEY not set"); process.exit(1); }
if (!SELLER_ADDRESS) { console.error("NEXT_PUBLIC_SELLER_ADDRESS not set"); process.exit(1); }

const REGISTRY_ABI = parseAbi([
  "function registerAgent(string name, string description, string serviceUrl, uint256 pricePerCall, address walletAddress, string[] tags) returns (uint256)",
  "function totalAgents() view returns (uint256)",
]);

const AGENTS = [
  {
    name: "Text Summarizer",
    description: "Condenses any text into a clear 2-4 sentence summary. Handles articles, documents, and long-form content. Returns the core meaning fast.",
    path: "/api/workers/summarize",
    price: 500n,
    tags: ["summarizer", "nlp", "text"],
  },
  {
    name: "Keyword Extractor",
    description: "Pulls the top keywords and key phrases from any text. Returns a comma-separated list ranked by importance. Useful for tagging and search indexing.",
    path: "/api/workers/keywords",
    price: 300n,
    tags: ["keywords", "extraction", "nlp"],
  },
  {
    name: "Sentiment Analyzer",
    description: "Classifies text as positive, negative, or neutral with a confidence score and one-sentence reasoning. Built for reviews, feedback, and social content.",
    path: "/api/workers/sentiment",
    price: 300n,
    tags: ["sentiment", "analysis", "nlp"],
  },
  {
    name: "Q&A Agent",
    description: "Answers questions directly and precisely. Accepts optional context to ground answers in your data. Handles factual, analytical, and open-ended questions.",
    path: "/api/workers/qa",
    price: 800n,
    tags: ["qa", "question", "reasoning"],
  },
  {
    name: "Translator",
    description: "Translates text into any target language. Auto-detects the source language and returns the translation with detected language metadata.",
    path: "/api/workers/translate",
    price: 500n,
    tags: ["translate", "language", "multilingual"],
  },
];

const RPC = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const account = privateKeyToAccount(DEPLOYER_KEY);
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC) });
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC) });

async function supabaseUpsert(agent, agentId, txHash) {
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.log("  Supabase not configured, skipping DB upsert"); return; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      agent_id: agentId,
      name: agent.name,
      description: agent.description,
      service_url: `${APP_URL}${agent.path}`,
      price_per_call: Number(agent.price),
      wallet_address: SELLER_ADDRESS.toLowerCase(),
      owner_address: account.address.toLowerCase(),
      tags: agent.tags,
      is_active: true,
      tx_hash: txHash,
      total_calls: 0,
      total_revenue: 0,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`  Supabase upsert failed: ${err}`);
  } else {
    console.log(`  Supabase upserted agent_id=${agentId}`);
  }
}

async function main() {
  const before = await publicClient.readContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: "totalAgents" });
  console.log(`\nRegistry has ${before} agent(s) before registration.\n`);

  for (const agent of AGENTS) {
    const serviceUrl = `${APP_URL}${agent.path}`;
    console.log(`Registering: ${agent.name}`);
    console.log(`  serviceUrl: ${serviceUrl}`);
    console.log(`  price:      $${(Number(agent.price) / 1_000_000).toFixed(6)} USDC`);
    console.log(`  tags:       [${agent.tags.join(", ")}]`);

    try {
      const hash = await walletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "registerAgent",
        args: [agent.name, agent.description, serviceUrl, agent.price, SELLER_ADDRESS, agent.tags],
      });
      console.log(`  tx: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  confirmed in block ${receipt.blockNumber}`);

      const after = await publicClient.readContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: "totalAgents" });
      const agentId = Number(after);
      console.log(`  agentId: ${agentId}`);

      await supabaseUpsert(agent, agentId, hash);
      console.log(`  done.\n`);
    } catch (e) {
      console.error(`  FAILED: ${e.message}\n`);
    }
  }

  const after = await publicClient.readContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: "totalAgents" });
  console.log(`\nDone. Registry now has ${after} agent(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
