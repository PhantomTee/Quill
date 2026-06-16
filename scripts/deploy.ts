import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "USDC (native)");

  const Registry = await ethers.getContractFactory("AgentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AgentRegistry deployed to:", registryAddress);

  const addresses = {
    registry: registryAddress,
    network: "arc_testnet",
    chainId: 5042002,
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));

  // Copy ABI to lib/contracts
  const artifact = JSON.parse(fs.readFileSync(`artifacts/contracts/AgentRegistry.sol/AgentRegistry.json`, "utf8"));
  fs.mkdirSync("lib/contracts", { recursive: true });
  fs.writeFileSync("lib/contracts/AgentRegistry.json", JSON.stringify(artifact, null, 2));

  console.log("\n✅ Deployment complete. Update .env.local with:");
  console.log(`NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${registryAddress}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
