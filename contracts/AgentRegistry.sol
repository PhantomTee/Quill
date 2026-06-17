// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title AgentRegistry
 * @notice Registry for AI agents on the Quill marketplace.
 *         Tracks on-chain reputation (totalCalls, successCount), unique payers,
 *         and optional USDC stake as a quality bond.
 */
contract AgentRegistry {
    address public immutable owner;
    address public immutable usdc;
    uint256 public nextAgentId;
    bool public paused;

    uint256 public constant MAX_TAGS = 10;
    uint256 public constant MAX_NAME_LENGTH = 80;
    uint256 public constant MAX_URL_LENGTH = 512;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;

    struct Agent {
        uint256 id;
        string name;
        string description;
        string serviceUrl;
        uint256 pricePerCall;
        address payable walletAddress;
        string[] tags;
        address agentOwner;
        bool isActive;
        uint256 registeredAt;
        uint256 updatedAt;
        uint256 totalCalls;
        uint256 successCount;   // calls that resolved successfully (200 OK)
        uint256 uniquePayers;   // distinct payers — set by owner via sync cron
        uint256 stakeAmount;    // USDC staked as quality bond (6 decimals)
    }

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public agentsByOwner;
    mapping(string => uint256[]) public agentsByTag;

    // ─── Events ──────────────────────────────────────────────────────────────

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed agentOwner,
        address indexed walletAddress,
        string serviceUrl,
        uint256 pricePerCall,
        uint256 registeredAt
    );
    event AgentUpdated(uint256 indexed agentId, string serviceUrl, uint256 pricePerCall, uint256 updatedAt);
    event AgentDeactivated(uint256 indexed agentId, address indexed agentOwner, uint256 deactivatedAt);
    event AgentReactivated(uint256 indexed agentId, address indexed agentOwner, uint256 reactivatedAt);
    event CallRecorded(uint256 indexed agentId, uint256 totalCalls, uint256 successCount);
    event UniquePrayersUpdated(uint256 indexed agentId, uint256 uniquePayers);
    event Staked(uint256 indexed agentId, address indexed staker, uint256 amount);
    event StakeWithdrawn(uint256 indexed agentId, address indexed owner, uint256 amount);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() { require(msg.sender == owner, "AgentRegistry: not owner"); _; }
    modifier notPaused() { require(!paused, "AgentRegistry: paused"); _; }
    modifier onlyAgentOwner(uint256 agentId) {
        require(agents[agentId].agentOwner == msg.sender, "AgentRegistry: not agent owner");
        _;
    }
    modifier agentExists(uint256 agentId) {
        require(agentId > 0 && agentId < nextAgentId, "AgentRegistry: agent does not exist");
        _;
    }

    constructor(address _usdc) {
        owner = msg.sender;
        usdc = _usdc;
        nextAgentId = 1;
    }

    // ─── Registration ────────────────────────────────────────────────────────

    function registerAgent(
        string calldata name,
        string calldata description,
        string calldata serviceUrl,
        uint256 pricePerCall,
        address payable walletAddress,
        string[] calldata tags
    ) external notPaused returns (uint256 agentId) {
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME_LENGTH, "AgentRegistry: invalid name");
        require(bytes(serviceUrl).length > 0 && bytes(serviceUrl).length <= MAX_URL_LENGTH, "AgentRegistry: invalid url");
        require(bytes(description).length <= MAX_DESCRIPTION_LENGTH, "AgentRegistry: description too long");
        require(pricePerCall > 0, "AgentRegistry: price must be > 0");
        require(walletAddress != address(0), "AgentRegistry: invalid wallet");
        require(tags.length <= MAX_TAGS, "AgentRegistry: too many tags");

        agentId = nextAgentId++;

        string[] memory tagsCopy = new string[](tags.length);
        for (uint256 i = 0; i < tags.length; i++) {
            tagsCopy[i] = tags[i];
            agentsByTag[tags[i]].push(agentId);
        }

        agents[agentId] = Agent({
            id: agentId,
            name: name,
            description: description,
            serviceUrl: serviceUrl,
            pricePerCall: pricePerCall,
            walletAddress: walletAddress,
            tags: tagsCopy,
            agentOwner: msg.sender,
            isActive: true,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            totalCalls: 0,
            successCount: 0,
            uniquePayers: 0,
            stakeAmount: 0
        });

        agentsByOwner[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, walletAddress, serviceUrl, pricePerCall, block.timestamp);
    }

    // ─── Staking ─────────────────────────────────────────────────────────────

    /**
     * @notice Agent owner stakes USDC as a quality bond. Higher stake = stronger signal.
     *         Requires prior ERC20 approval: usdc.approve(registryAddress, amount)
     */
    function stake(uint256 agentId, uint256 amount)
        external
        agentExists(agentId)
        onlyAgentOwner(agentId)
        notPaused
    {
        require(amount > 0, "AgentRegistry: amount must be > 0");
        require(IERC20(usdc).transferFrom(msg.sender, address(this), amount), "AgentRegistry: transfer failed");
        agents[agentId].stakeAmount += amount;
        emit Staked(agentId, msg.sender, amount);
    }

    /**
     * @notice Withdraw stake. Only allowed when agent is inactive (deactivated).
     */
    function withdrawStake(uint256 agentId)
        external
        agentExists(agentId)
        onlyAgentOwner(agentId)
    {
        Agent storage agent = agents[agentId];
        require(!agent.isActive, "AgentRegistry: deactivate agent before withdrawing stake");
        require(agent.stakeAmount > 0, "AgentRegistry: no stake to withdraw");
        uint256 amount = agent.stakeAmount;
        agent.stakeAmount = 0;
        require(IERC20(usdc).transfer(msg.sender, amount), "AgentRegistry: transfer failed");
        emit StakeWithdrawn(agentId, msg.sender, amount);
    }

    // ─── Reputation (owner-gated) ─────────────────────────────────────────

    /**
     * @notice Record a call outcome. Called by the marketplace server post-settlement.
     * @param success  true if the agent returned 2xx (counted toward successCount)
     */
    function recordCall(uint256 agentId, bool success)
        external
        onlyOwner
        agentExists(agentId)
    {
        agents[agentId].totalCalls += 1;
        if (success) agents[agentId].successCount += 1;
        emit CallRecorded(agentId, agents[agentId].totalCalls, agents[agentId].successCount);
    }

    /**
     * @notice Set the unique payers count — synced from Supabase by the cron.
     *         On-chain deduplication of addresses is gas-prohibitive; owner sets the count.
     */
    function setUniquePayers(uint256 agentId, uint256 count)
        external
        onlyOwner
        agentExists(agentId)
    {
        agents[agentId].uniquePayers = count;
        emit UniquePrayersUpdated(agentId, count);
    }

    // ─── Mutation ────────────────────────────────────────────────────────────

    function updateAgent(
        uint256 agentId,
        string calldata serviceUrl,
        uint256 pricePerCall,
        string calldata description
    ) external agentExists(agentId) onlyAgentOwner(agentId) notPaused {
        require(bytes(serviceUrl).length > 0 && bytes(serviceUrl).length <= MAX_URL_LENGTH, "AgentRegistry: invalid url");
        require(pricePerCall > 0, "AgentRegistry: price must be > 0");

        Agent storage agent = agents[agentId];
        agent.serviceUrl = serviceUrl;
        agent.pricePerCall = pricePerCall;
        if (bytes(description).length > 0) agent.description = description;
        agent.updatedAt = block.timestamp;

        emit AgentUpdated(agentId, serviceUrl, pricePerCall, block.timestamp);
    }

    function deactivateAgent(uint256 agentId) external agentExists(agentId) onlyAgentOwner(agentId) {
        require(agents[agentId].isActive, "AgentRegistry: already inactive");
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId, msg.sender, block.timestamp);
    }

    function reactivateAgent(uint256 agentId) external agentExists(agentId) onlyAgentOwner(agentId) notPaused {
        require(!agents[agentId].isActive, "AgentRegistry: already active");
        agents[agentId].isActive = true;
        emit AgentReactivated(agentId, msg.sender, block.timestamp);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getAgent(uint256 agentId) external view agentExists(agentId) returns (Agent memory) {
        return agents[agentId];
    }

    function getAgentsByOwner(address agentOwner) external view returns (uint256[] memory) {
        return agentsByOwner[agentOwner];
    }

    function getAgentsByTag(string calldata tag) external view returns (uint256[] memory) {
        return agentsByTag[tag];
    }

    function totalAgents() external view returns (uint256) {
        return nextAgentId - 1;
    }

    /**
     * @notice Compute success rate as a fraction (scaled 1e4 = 100.00%)
     *         Returns 0 if no calls recorded yet.
     */
    function successRate(uint256 agentId) external view agentExists(agentId) returns (uint256) {
        Agent storage agent = agents[agentId];
        if (agent.totalCalls == 0) return 0;
        return (agent.successCount * 10_000) / agent.totalCalls;
    }

    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }
}
