// Deploy AgentRegistry to Arc Testnet using viem
// Usage: node --env-file=.env.local scripts/deploy-registry.mjs

import { createWalletClient, createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const RPC = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!DEPLOYER_KEY) { console.error("DEPLOYER_PRIVATE_KEY not set"); process.exit(1); }

const account = privateKeyToAccount(DEPLOYER_KEY);
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC) });
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC) });

// Read compiled artifact
let artifact;
try {
  artifact = JSON.parse(readFileSync("artifacts/contracts/AgentRegistry.sol/AgentRegistry.json", "utf8"));
} catch {
  console.error("Artifact not found. Run: npx hardhat compile");
  process.exit(1);
}

async function main() {
  console.log(`\nDeploying AgentRegistry to Arc Testnet`);
  console.log(`Deployer: ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:  ${(Number(balance) / 1e18).toFixed(6)} native\n`);

  // Arc Testnet USDC address
  const USDC = "0x3600000000000000000000000000000000000000";

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [USDC],
  });

  console.log(`Deploy tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  console.log(`Deployed:  ${address}`);
  console.log(`Block:     ${receipt.blockNumber}\n`);

  // Save address
  writeFileSync("deployed-addresses.json", JSON.stringify({
    registry: address,
    network: "arc_testnet",
    chainId: 5042002,
    deployedAt: new Date().toISOString(),
  }, null, 2));

  // Copy ABI to lib/contracts
  mkdirSync("lib/contracts", { recursive: true });
  writeFileSync("lib/contracts/AgentRegistry.json", JSON.stringify(artifact, null, 2));

  console.log(`Update .env.local and Vercel with:`);
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${address}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
