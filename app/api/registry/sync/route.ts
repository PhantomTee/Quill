import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPublicClient, REGISTRY_ADDRESS, REGISTRY_ABI, formatUSDC } from "@/lib/arc";

// Sync on-chain AgentRegistered events to Supabase
// Called by GitHub Actions every 10 minutes (.github/workflows/sync.yml)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!REGISTRY_ADDRESS) {
    return NextResponse.json({ error: "Registry not configured" }, { status: 503 });
  }

  try {
    const client = getPublicClient();

    // Get the last synced block from Supabase
    const { data: syncState } = await supabase
      .from("sync_state")
      .select("last_block")
      .eq("id", "agent_registry")
      .single();

    const fromBlock = BigInt(syncState?.last_block ?? 0);
    const toBlock = await client.getBlockNumber();

    if (fromBlock >= toBlock) {
      return NextResponse.json({ synced: 0, message: "Up to date" });
    }

    // Fetch AgentRegistered events
    const logs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: {
        name: "AgentRegistered",
        type: "event",
        inputs: [
          { indexed: true, name: "agentId", type: "uint256" },
          { indexed: true, name: "agentOwner", type: "address" },
          { indexed: true, name: "walletAddress", type: "address" },
          { indexed: false, name: "serviceUrl", type: "string" },
          { indexed: false, name: "pricePerCall", type: "uint256" },
          { indexed: false, name: "registeredAt", type: "uint256" },
        ],
      },
      fromBlock: fromBlock + 1n,
      toBlock,
    });

    let synced = 0;
    for (const log of logs) {
      const { agentId, agentOwner, walletAddress, serviceUrl, pricePerCall, registeredAt } = log.args as {
        agentId: bigint;
        agentOwner: string;
        walletAddress: string;
        serviceUrl: string;
        pricePerCall: bigint;
        registeredAt: bigint;
      };

      // Fetch full agent metadata from chain (name, description, tags)
      let name = `Agent #${agentId}`;
      let description = "";
      let tags: string[] = [];
      try {
        const agentData = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "getAgent",
          args: [agentId],
        }) as [bigint, string, string, string, bigint, string, string[], string, boolean, bigint, bigint, bigint];
        name = agentData[1] || name;
        description = agentData[2] || "";
        tags = agentData[6] || [];
      } catch { /* fall back to defaults */ }

      const { error } = await supabase.from("agents").upsert({
        agent_id: Number(agentId),
        name,
        description,
        service_url: serviceUrl,
        price_per_call: Number(pricePerCall),
        wallet_address: walletAddress.toLowerCase(),
        owner_address: agentOwner.toLowerCase(),
        tags,
        is_active: true,
        registered_at: new Date(Number(registeredAt) * 1000).toISOString(),
        tx_hash: log.transactionHash,
        total_calls: 0,
        total_revenue: 0,
      }, { onConflict: "agent_id", ignoreDuplicates: true });

      if (!error) synced++;
    }

    // Update sync state
    await supabase.from("sync_state").upsert({
      id: "agent_registry",
      last_block: Number(toBlock),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    return NextResponse.json({ synced, fromBlock: Number(fromBlock), toBlock: Number(toBlock) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
