import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPublicClient, getWalletClient, REGISTRY_ADDRESS, REGISTRY_ABI } from "@/lib/arc";

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

    // ── 1. Sync new AgentRegistered events → Supabase ─────────────────────
    const { data: syncState } = await supabase
      .from("sync_state")
      .select("last_block")
      .eq("id", "agent_registry")
      .single();

    const fromBlock = BigInt(syncState?.last_block ?? 0);
    const toBlock = await client.getBlockNumber();
    let synced = 0;

    if (fromBlock < toBlock) {
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

      for (const log of logs) {
        const { agentId, agentOwner, walletAddress, serviceUrl, pricePerCall, registeredAt } = log.args as {
          agentId: bigint;
          agentOwner: string;
          walletAddress: string;
          serviceUrl: string;
          pricePerCall: bigint;
          registeredAt: bigint;
        };

        let name = `Agent #${agentId}`;
        let description = "";
        let tags: string[] = [];
        let stakeAmountUsdc = 0;
        try {
          const a = await client.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "getAgent",
            args: [agentId],
          }) as [bigint, string, string, string, bigint, string, string[], string, boolean, bigint, bigint, bigint, bigint, bigint, bigint];
          name = a[1] || name;
          description = a[2] || "";
          tags = a[6] || [];
          stakeAmountUsdc = Number(a[14]) / 1_000_000; // stakeAmount in USDC
        } catch { /* defaults */ }

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
          success_count: 0,
          unique_payers: 0,
          stake_amount_usdc: stakeAmountUsdc,
        }, { onConflict: "agent_id", ignoreDuplicates: true });

        if (!error) synced++;
      }

      await supabase.from("sync_state").upsert({
        id: "agent_registry",
        last_block: Number(toBlock),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }

    // ── 2. Compute unique_payers per agent from payment_events → Supabase + chain ──
    const { data: payerCounts } = await supabase
      .rpc("agent_unique_payers" as never)
      .then(
        (r) => r,
        () => ({ data: null })
      );

    // Fallback: manual query if RPC doesn't exist yet
    let uniquePayersMap: Record<number, number> = {};
    if (payerCounts && Array.isArray(payerCounts)) {
      uniquePayersMap = Object.fromEntries(
        payerCounts.map((r: { agent_id: number; count: number }) => [r.agent_id, r.count])
      );
    } else {
      // Compute from payment_events directly
      const { data: agents } = await supabase.from("agents").select("agent_id");
      if (agents) {
        await Promise.all(agents.map(async ({ agent_id }) => {
          const { count } = await supabase
            .from("payment_events")
            .select("payer", { count: "exact", head: true })
            .eq("agent_id", agent_id)
            .eq("status", "settled")
            // Supabase doesn't support COUNT(DISTINCT) in REST — approximate with limit
            .then((r) => ({ count: r.count ?? 0 }));
          uniquePayersMap[agent_id] = count;
        }));
      }
    }

    // Update Supabase agents rows with unique_payers
    let payersSynced = 0;
    const walletClient = getWalletClient();
    for (const [agentIdStr, count] of Object.entries(uniquePayersMap)) {
      const agentId = Number(agentIdStr);
      await supabase
        .from("agents")
        .update({ unique_payers: count })
        .eq("agent_id", agentId)
        .then(() => null, () => null);

      // Push to chain if the agent exists on-chain
      try {
        await walletClient.writeContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "setUniquePayers",
          args: [BigInt(agentId), BigInt(count)],
        });
        payersSynced++;
      } catch {
        // non-fatal — on-chain sync is best-effort
      }
    }

    return NextResponse.json({
      synced,
      payersSynced,
      fromBlock: Number(fromBlock),
      toBlock: Number(toBlock),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
