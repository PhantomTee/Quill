#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const solc = require("solc");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { createWalletClient, createPublicClient, http, defineChain } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "ARC", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
});

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env.local");

  const account = privateKeyToAccount(pk);
  console.log("Deploying with:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", (Number(balance) / 1e18).toFixed(6), "ARC");

  // Read and compile contract
  const src = fs.readFileSync(path.join(__dirname, "../contracts/AgentRegistry.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "AgentRegistry.sol": { content: src } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } }, optimizer: { enabled: true, runs: 200 } },
  };
  console.log("Compiling AgentRegistry.sol...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errs = output.errors.filter((e) => e.severity === "error");
    if (errs.length) { errs.forEach((e) => console.error(e.formattedMessage)); throw new Error("Compilation failed"); }
  }
  const contract = output.contracts["AgentRegistry.sol"]["AgentRegistry"];
  const abi = contract.abi;
  const bytecode = "0x" + contract.evm.bytecode.object;
  console.log("Compiled. Bytecode size:", bytecode.length / 2 - 1, "bytes");

  // Deploy
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });
  console.log("Sending deploy tx...");
  const hash = await walletClient.deployContract({ abi, bytecode, args: [] });
  console.log("Tx hash:", hash);
  console.log("Waiting for receipt...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const registryAddress = receipt.contractAddress;
  console.log("\nAgentRegistry deployed to:", registryAddress);

  // Save artifacts
  const addresses = { registry: registryAddress, network: "arc_testnet", chainId: 5042002, deployedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, "../deployed-addresses.json"), JSON.stringify(addresses, null, 2));
  fs.mkdirSync(path.join(__dirname, "../lib/contracts"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "../lib/contracts/AgentRegistry.json"), JSON.stringify({ abi, bytecode }, null, 2));

  console.log("\nDeployment complete. Update .env.local with:");
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
