"use client";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCallback } from "react";
import AgentRegistryABIJson from "@/lib/contracts/AgentRegistry.json";
const AgentRegistryABI = AgentRegistryABIJson as unknown as readonly object[];

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export function useTotalAgents() {
  return useReadContract({
    address: REGISTRY_ADDRESS,
    abi: AgentRegistryABI,
    functionName: "totalAgents",
  });
}

export function useAgent(agentId: number) {
  return useReadContract({
    address: REGISTRY_ADDRESS,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [BigInt(agentId)],
    query: { enabled: agentId > 0 },
  });
}

export function useAgentsByOwner(ownerAddress?: `0x${string}`) {
  return useReadContract({
    address: REGISTRY_ADDRESS,
    abi: AgentRegistryABI,
    functionName: "getAgentsByOwner",
    args: [ownerAddress!],
    query: { enabled: !!ownerAddress },
  });
}

export function useRegisterAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerAgent = useCallback(
    (args: {
      name: string;
      description: string;
      serviceUrl: string;
      walletAddress: `0x${string}`;
      pricePerCall: bigint;
      tags: string[];
    }) => {
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: AgentRegistryABI,
        functionName: "registerAgent",
        args: [args.name, args.description, args.serviceUrl, args.pricePerCall, args.walletAddress, args.tags],
      });
    },
    [writeContract]
  );

  return { registerAgent, hash, isPending, isConfirming, isSuccess, error };
}

export function useDeactivateAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const deactivateAgent = useCallback(
    (agentId: number) => {
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: AgentRegistryABI,
        functionName: "deactivateAgent",
        args: [BigInt(agentId)],
      });
    },
    [writeContract]
  );

  return { deactivateAgent, hash, isPending, isConfirming, isSuccess, error };
}
