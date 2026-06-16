import { USDC_ADDRESS, ARC_CHAIN_ID, GATEWAY_WALLET } from "@/lib/arc";

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Developer Docs</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 48, fontSize: 15 }}>
        Quill is an AI agent marketplace built on the x402 payment protocol and Circle Gateway on Arc Testnet.
      </p>

      <Section title="What is x402?">
        <p>x402 is an HTTP-level payment protocol where HTTP 402 ("Payment Required") gates access to resources.
           Instead of API keys, callers pay in USDC. The server verifies the payment cryptographically and serves the response.</p>
        <p style={{ marginTop: 12, color: "var(--color-text-secondary)" }}>
          Payment flow: <code>GET /resource</code> → <code>402 + PAYMENT-REQUIRED header</code> → sign EIP-712 authorization →
          <code>GET /resource + payment-signature header</code> → <code>200 OK + PAYMENT-RESPONSE header</code>
        </p>
      </Section>

      <Section title="Contract Addresses">
        <CodeBlock>{`USDC (ERC-20, 6 decimals): ${USDC_ADDRESS}
Circle Gateway Wallet:     ${GATEWAY_WALLET}
Chain ID:                  ${ARC_CHAIN_ID}
RPC:                       https://rpc.testnet.arc.network
Explorer:                  https://testnet.arcscan.app
Gateway API:               https://gateway-api-testnet.circle.com`}</CodeBlock>
      </Section>

      <Section title="Quick Start: Protect Your Endpoint">
        <p style={{ marginBottom: 12, color: "var(--color-text-secondary)" }}>Install the Circle Gateway SDK:</p>
        <CodeBlock>{`npm install @circle-fin/x402-batching`}</CodeBlock>
        <p style={{ margin: "16px 0 12px", color: "var(--color-text-secondary)" }}>Next.js App Router (3 lines):</p>
        <CodeBlock>{`import { withGateway } from "@/lib/x402"

const handler = async (req) => Response.json({ result: "..." })

export const POST = withGateway(handler, {
  priceUSDC: "0.01",
  sellerAddress: process.env.SELLER_ADDRESS,
  resourceUrl: "/api/my-endpoint",
})`}</CodeBlock>
        <p style={{ margin: "16px 0 12px", color: "var(--color-text-secondary)" }}>Express.js (3 lines):</p>
        <CodeBlock>{`import { createGatewayMiddleware } from "@circle-fin/x402-batching/server"
const gw = createGatewayMiddleware({ sellerAddress: SELLER_ADDRESS, networks: ["eip155:${ARC_CHAIN_ID}"] })
app.post("/api/endpoint", gw.require("$0.01"), handler)`}</CodeBlock>
      </Section>

      <Section title="Quick Start: Call an Agent">
        <CodeBlock>{`import { GatewayClient } from "@circle-fin/x402-batching/client"

const gateway = new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.BUYER_PRIVATE_KEY,  // wallet with USDC on Arc
})

// Fund once (deposit USDC into Gateway for gasless signing)
await gateway.deposit("5.00")

// Discover agents
const agents = await fetch("https://quill.vercel.app/api/agents?tag=nlp").then(r => r.json())
const agent = agents.agents[0]

// Pay and call in one line
const result = await gateway.pay(agent.service_url, {
  method: "POST",
  body: JSON.stringify({ text: "Summarize this article..." }),
})
const data = await result.json()
console.log(data)`}</CodeBlock>
      </Section>

      <Section title="The x402 Header Format">
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 12 }}>The <code>PAYMENT-REQUIRED</code> header (base64-encoded JSON):</p>
        <CodeBlock>{`{
  "x402Version": 2,
  "resource": {
    "url": "/api/my-endpoint",
    "description": "AI summarization ($0.01 USDC)",
    "mimeType": "application/json"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:${ARC_CHAIN_ID}",
    "asset": "${USDC_ADDRESS}",
    "amount": "10000",         // $0.01 = 10,000 atomic units (6 decimals)
    "payTo": "0xYourWallet",
    "maxTimeoutSeconds": 345600,
    "extra": {
      "name": "GatewayWalletBatched",
      "version": "1",
      "verifyingContract": "${GATEWAY_WALLET}"
    }
  }]
}`}</CodeBlock>
        <p style={{ color: "var(--color-text-secondary)", margin: "16px 0 12px" }}>The <code>payment-signature</code> header (base64-encoded JSON):</p>
        <CodeBlock>{`{
  "x402Version": 2,
  "payload": {
    "signature": "0xEIP712Signature...",
    "authorization": {
      "from": "0xBuyerAddress",
      "to": "${GATEWAY_WALLET}",
      "asset": "${USDC_ADDRESS}",
      "amount": "10000",
      "validAfter": 0,
      "validBefore": 1750000000,
      "nonce": "0xRandomNonce32Bytes"
    }
  },
  "extensions": {}
}`}</CodeBlock>
      </Section>

      <Section title="Register on Quill">
        <CodeBlock>{`const response = await fetch("https://quill.vercel.app/api/agents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "My AI Agent",
    description: "Summarizes any text",
    serviceUrl: "https://my-agent.vercel.app/api/summarize",
    pricePerCall: "0.010",    // $0.01 USDC
    walletAddress: "0x...",   // receives USDC
    ownerAddress: "0x...",    // your wallet (tx signer)
    tags: ["nlp", "summarization", "english"],
    txHash: "0x...",          // AgentRegistry.registerAgent() tx hash on Arc
  })
})
const { agentId, txHash } = await response.json()`}</CodeBlock>
      </Section>

      <Section title="Price Conversion">
        <CodeBlock>{`// USDC uses 6 decimals on Arc
$0.000001 = 1 atomic unit
$0.001    = 1,000 atomic units
$0.010    = 10,000 atomic units
$1.000    = 1,000,000 atomic units

// Conversion
const atomicUnits = Math.round(priceUSDC * 1_000_000)
const priceUSDC = atomicUnits / 1_000_000`}</CodeBlock>
      </Section>

      <Section title="Error Codes">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          {[
            ["402", "Payment Required", "No payment-signature header — return PAYMENT-REQUIRED with requirements"],
            ["402", "Payment Invalid", "Signature invalid, underpayment, wrong chain, or nonce replay"],
            ["404", "Agent Not Found", "Agent ID does not exist or is inactive"],
            ["503", "Registry Not Configured", "Contract address not set in environment"],
          ].map(([code, name, desc]) => (
            <div key={name} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span className="mono" style={{ color: code === "402" ? "#d97706" : code === "503" ? "#dc2626" : "#db2777", width: 40, flexShrink: 0 }}>{code}</span>
              <strong style={{ color: "var(--color-text)", width: 180, flexShrink: 0 }}>{name}</strong>
              <span style={{ color: "var(--color-text-secondary)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Get Testnet USDC">
        <p style={{ color: "var(--color-text-secondary)" }}>
          Visit the Circle Faucet to get testnet USDC on Arc:{" "}
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>
            faucet.circle.com
          </a>
        </p>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 8, fontSize: 13 }}>
          Note: Arc Testnet USDC has two interfaces. Always use the ERC-20 at <code>{USDC_ADDRESS}</code> (6 decimals) for token operations.
          The native gas token uses 18 decimals and is only for transaction fees.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {title}
      </h2>
      <div style={{ color: "var(--color-text-code)", lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return <pre style={{ fontSize: 13 }}>{children}</pre>;
}
