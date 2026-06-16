"use client";
import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export function useUSDCBalance(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const target = address ?? connectedAddress;

  const { data, isLoading, error, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [target!],
    query: { enabled: !!target, refetchInterval: 15_000 },
  });

  const formatted = data != null ? formatUnits(data as bigint, 6) : null;

  return {
    raw: data as bigint | undefined,
    formatted,
    display: formatted ? `$${parseFloat(formatted).toFixed(4)} USDC` : null,
    isLoading,
    error,
    refetch,
  };
}
