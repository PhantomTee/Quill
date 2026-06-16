export { AgentBuilder } from "./AgentBuilder";
export { AgentCaller } from "./AgentCaller";
export { withNextGateway, expressGateway, withFetchGateway } from "./x402Middleware";
export type {
  QuillConfig,
  AgentRegistration,
  CallResult,
  QuillAgent,
  GatewayBalance,
} from "./types";

export const QUILL_CONSTANTS = {
  ARC_CHAIN_ID: 5042002,
  ARC_RPC: "https://rpc.testnet.arc.network",
  ARC_EXPLORER: "https://testnet.arcscan.app",
  USDC_ADDRESS: "0x3600000000000000000000000000000000000000",
  GATEWAY_WALLET: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
  CIRCLE_GATEWAY_API: "https://gateway-api-testnet.circle.com",
  USDC_DECIMALS: 6,
} as const;
