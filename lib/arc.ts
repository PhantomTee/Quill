import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits, type PublicClient } from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import AgentRegistryABI from "./contracts/AgentRegistry.json";

export const ARC_RPC = "https://rpc.testnet.arc.network";
export const ARC_CHAIN_ID = 5042002;
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const;
export const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;
export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "") as `0x${string}`;
export const USDC_DECIMALS = 6;

export const REGISTRY_ABI = parseAbi([
  "function registerAgent(string name, string description, string serviceUrl, uint256 pricePerCall, address walletAddress, string[] tags) returns (uint256)",
  "function getAgent(uint256 agentId) view returns ((uint256,string,string,string,uint256,address,string[],address,bool,uint256,uint256,uint256))",
  "function getAgentsByOwner(address agentOwner) view returns (uint256[])",
  "function totalAgents() view returns (uint256)",
  "function updateAgent(uint256 agentId, string serviceUrl, uint256 pricePerCall, string description)",
  "function deactivateAgent(uint256 agentId)",
  "function reactivateAgent(uint256 agentId)",
  "event AgentRegistered(uint256 indexed agentId, address indexed agentOwner, address indexed walletAddress, string serviceUrl, uint256 pricePerCall, uint256 registeredAt)",
  "event AgentUpdated(uint256 indexed agentId, string serviceUrl, uint256 pricePerCall, uint256 updatedAt)",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
]);

// Server-side public client
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC),
  }) as PublicClient;
}

// Server-side wallet client (for contract interactions)
export function getWalletClient() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.SELLER_PRIVATE_KEY;
  if (!privateKey) throw new Error("No private key configured");
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC),
  });
}

export function formatUSDC(amount: bigint | string | number): string {
  return formatUnits(BigInt(amount.toString()), USDC_DECIMALS);
}

export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

// Format price for display
export function formatPrice(atomicUnits: bigint | number | string): string {
  const val = parseFloat(formatUSDC(BigInt(atomicUnits.toString())));
  if (val < 0.001) return `$${val.toFixed(6)}`;
  if (val < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(3)}`;
}

// Truncate address for display
export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
