import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateAgentDescription } from "@/lib/groq";
import { getPublicClient, REGISTRY_ADDRESS, REGISTRY_ABI, parseUSDC } from "@/lib/arc";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? searchParams.get("search");
    const tag = searchParams.get("tag");
    const category = searchParams.get("category");
    const ownerAddress = searchParams.get("ownerAddress") ?? searchParams.get("owner");
    const sort = searchParams.get("sort") ?? "total_calls";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
    const offset = (page - 1) * limit;
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    let query = supabase
      .from("agents")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .range(offset, offset + limit - 1);

    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }
    if (category && category !== "ALL") {
      query = query.contains("tags", [category.toLowerCase()]);
    }
    if (ownerAddress) {
      query = query.eq("owner_address", ownerAddress.toLowerCase());
    }
    if (minPrice) {
      query = query.gte("price_per_call", parseFloat(minPrice) * 1_000_000);
    }
    if (maxPrice) {
      query = query.lte("price_per_call", parseFloat(maxPrice) * 1_000_000);
    }

    const sortMap: Record<string, string> = {
      total_calls: "total_calls",
      calls_desc: "total_calls",
      newest: "registered_at",
      price_asc: "price_per_call",
      price_desc: "price_per_call",
      revenue: "total_revenue",
    };
    const sortCol = sortMap[sort] ?? "total_calls";
    const ascending = sort === "price_asc";
    query = query.order(sortCol, { ascending });

    const { data, error, count } = await query;
    if (error) throw error;

    const agents = (data ?? []).map((a) => ({
      ...a,
      priceFormatted: `${(a.price_per_call / 1_000_000).toFixed(4)}`,
    }));

    return NextResponse.json({
      agents,
      total: count ?? 0,
      page,
      limit,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      serviceUrl,
      pricePerCall,
      walletAddress,
      ownerAddress,
      tags,
      readme,
      exampleRequest,
      exampleResponse,
      txHash,
    } = body;

    if (!name || !serviceUrl || !walletAddress || !ownerAddress) {
      return NextResponse.json({ error: "Missing required fields: name, serviceUrl, walletAddress, ownerAddress" }, { status: 400 });
    }
    if (!serviceUrl.startsWith("https://") && !serviceUrl.startsWith("http://localhost")) {
      return NextResponse.json({ error: "Service URL must use HTTPS" }, { status: 400 });
    }

    const priceAtomicUnits = Math.round(parseFloat(pricePerCall) * 1_000_000);
    if (!priceAtomicUnits || priceAtomicUnits <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // Get on-chain agent ID from tx hash
    let agentId: number | null = null;
    if (txHash && REGISTRY_ADDRESS) {
      try {
        const client = getPublicClient();
        const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
        if (receipt.status === "success") {
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
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber,
          });
          const matchingLog = logs.find(
            (l) => l.transactionHash?.toLowerCase() === txHash.toLowerCase()
          );
          if (matchingLog?.args?.agentId) {
            agentId = Number(matchingLog.args.agentId);
          }
        }
      } catch {
        // Non-fatal — use next available ID from Supabase
      }
    }

    // AI-enhance description if not provided
    let finalDescription = description;
    if ((!finalDescription || finalDescription.length < 20) && process.env.GROQ_API_KEY) {
      finalDescription = await generateAgentDescription(name, tags ?? []);
    }

    // Determine agent_id: use on-chain id or get max+1 from Supabase
    if (!agentId) {
      const { data: maxRow } = await supabase
        .from("agents")
        .select("agent_id")
        .order("agent_id", { ascending: false })
        .limit(1)
        .single();
      agentId = (maxRow?.agent_id ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from("agents")
      .insert({
        agent_id: agentId,
        name,
        description: finalDescription ?? null,
        service_url: serviceUrl,
        price_per_call: priceAtomicUnits,
        wallet_address: walletAddress.toLowerCase(),
        owner_address: ownerAddress.toLowerCase(),
        tags: tags ?? [],
        is_active: true,
        registered_at: new Date().toISOString(),
        tx_hash: txHash ?? null,
        readme: readme ?? null,
        example_request: exampleRequest ?? null,
        example_response: exampleResponse ?? null,
        total_calls: 0,
        total_revenue: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "An agent with this service URL or ID already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ agentId, txHash, agent: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
