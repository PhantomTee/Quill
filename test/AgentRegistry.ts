import { expect } from "chai";
import hre from "hardhat";
import type { NetworkConnection } from "hardhat/types/network";

type EthersConnection = NetworkConnection & { ethers: any };

describe("AgentRegistry", () => {
  let conn: EthersConnection;

  const PRICE = 1_000n;
  const NAME = "Test Agent";
  const DESC = "A test agent";
  const URL = "https://agent.example.com/api";
  const TAGS = ["nlp", "test"];

  before(async () => {
    conn = (await hre.network.create()) as EthersConnection;
  });

  async function deploy() {
    const Factory = await conn.ethers.getContractFactory("AgentRegistry");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    return contract;
  }

  describe("registerAgent", () => {
    it("registers an agent and increments totalAgents", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      expect(await registry.totalAgents()).to.equal(0n);
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      expect(await registry.totalAgents()).to.equal(1n);
    });

    it("stores correct agent data", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      const agent = await registry.getAgent(1n);
      expect(agent.name).to.equal(NAME);
      expect(agent.description).to.equal(DESC);
      expect(agent.serviceUrl).to.equal(URL);
      expect(agent.pricePerCall).to.equal(PRICE);
      expect(agent.walletAddress).to.equal(seller.address);
      expect(agent.agentOwner).to.equal(seller.address);
      expect(agent.isActive).to.equal(true);
    });

    it("reverts with zero price", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      let threw = false;
      try { await registry.connect(seller).registerAgent(NAME, DESC, URL, 0n, seller.address, TAGS); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });

    it("reverts with zero wallet address", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      let threw = false;
      try { await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, conn.ethers.ZeroAddress, TAGS); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });

    it("reverts with empty name", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      let threw = false;
      try { await registry.connect(seller).registerAgent("", DESC, URL, PRICE, seller.address, TAGS); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });

    it("reverts with more than 10 tags", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      const manyTags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      let threw = false;
      try { await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, manyTags); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });

    it("tracks multiple agents by owner", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      await (await registry.connect(seller).registerAgent("Agent 2", DESC, URL, PRICE, seller.address, [])).wait();
      const ids = await registry.getAgentsByOwner(seller.address);
      expect(ids.length).to.equal(2);
    });
  });

  describe("updateAgent", () => {
    it("allows owner to update service URL and price", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      await (await registry.connect(seller).updateAgent(1n, "https://v2.example.com/api", 2_000n, "Updated")).wait();
      const agent = await registry.getAgent(1n);
      expect(agent.serviceUrl).to.equal("https://v2.example.com/api");
      expect(agent.pricePerCall).to.equal(2_000n);
    });

    it("reverts if non-owner updates", async () => {
      const [, seller, other] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      let threw = false;
      try { await registry.connect(other).updateAgent(1n, URL, PRICE, DESC); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });
  });

  describe("deactivateAgent / reactivateAgent", () => {
    it("owner can deactivate then reactivate", async () => {
      const [, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      await (await registry.connect(seller).deactivateAgent(1n)).wait();
      expect((await registry.getAgent(1n)).isActive).to.equal(false);
      await (await registry.connect(seller).reactivateAgent(1n)).wait();
      expect((await registry.getAgent(1n)).isActive).to.equal(true);
    });

    it("non-owner cannot deactivate", async () => {
      const [, seller, other] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS)).wait();
      let threw = false;
      try { await registry.connect(other).deactivateAgent(1n); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });
  });

  describe("pause / unpause", () => {
    it("owner can pause to block registrations", async () => {
      const [owner, seller] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(owner).pause()).wait();
      let threw = false;
      try { await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, TAGS); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });

    it("non-owner cannot pause", async () => {
      const [, , other] = await conn.ethers.getSigners();
      const registry = await deploy();
      let threw = false;
      try { await registry.connect(other).pause(); }
      catch { threw = true; }
      expect(threw).to.equal(true);
    });
  });

  describe("getAgentsByTag", () => {
    it("indexes agents by tag correctly", async () => {
      const [, seller, other] = await conn.ethers.getSigners();
      const registry = await deploy();
      await (await registry.connect(seller).registerAgent(NAME, DESC, URL, PRICE, seller.address, ["nlp", "text"])).wait();
      await (await registry.connect(other).registerAgent("Agent 2", DESC, URL, PRICE, other.address, ["nlp", "code"])).wait();
      expect((await registry.getAgentsByTag("nlp")).length).to.equal(2);
      expect((await registry.getAgentsByTag("code")).length).to.equal(1);
    });
  });
});
