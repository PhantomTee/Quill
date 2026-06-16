export interface QuillConfig {
  rpc: string;
  chainId: number;
  usdcAddress: string;
  registryAddress: string;
  privateKey?: string;
}

export interface AgentRegistration {
  name: string;
  description?: string;
  serviceUrl: string;
  pricePerCall: string;       // USDC string, e.g. "0.01"
  walletAddress: `0x${string}`;
  tags?: string[];
  readme?: string;
  exampleRequest?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
}

export interface CallResult<T = unknown> {
  success: boolean;
  data?: T;
  settlementId?: string;
  amountPaid?: string;
  latencyMs?: number;
  error?: string;
}

export interface QuillAgent {
  agentId: number;
  name: string;
  description: string | null;
  serviceUrl: string;
  pricePerCall: bigint;
  priceFormatted: string;
  walletAddress: string;
  tags: string[];
  totalCalls: number;
  totalRevenue: string;
}

export interface GatewayBalance {
  available: string;
  withdrawing: string;
  wallet: {
    usdc: string;
    native: string;
  };
}
