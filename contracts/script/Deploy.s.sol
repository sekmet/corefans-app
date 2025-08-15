// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {SubscribeWithMax} from "../src/SubscribeWithMax.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {GemToken} from "../src/GemToken.sol";
import {AccessPass} from "../src/AccessPass.sol";
import {OracleConfigurator} from "../src/OracleConfigurator.sol";
import {Treasury} from "../src/Treasury.sol";

contract Deploy is Script {
    struct NetworkConfig {
        address allowToken;        // ERC20 to allowlist for subscriptions
        address defaultToken;      // payment token whose oracle default to set (address(0) for ETH)
        address defaultOracle;     // Chainlink-like aggregator for token/USD
        uint8 defaultTokenDecimals;// decimals for the payment token
    }

    function _loadNetworkConfig() internal view returns (NetworkConfig memory cfg) {
        cfg.allowToken = vm.envOr("ALLOW_TOKEN", address(0));
        cfg.defaultToken = vm.envOr("DEFAULT_TOKEN", address(0));
        cfg.defaultOracle = vm.envOr("DEFAULT_ORACLE", address(0));
        cfg.defaultTokenDecimals = uint8(vm.envOr("DEFAULT_TOKEN_DECIMALS", uint256(0)));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);
        address platformTreasury = vm.envOr("PLATFORM_TREASURY", owner);
        uint256 platformFeeBps = vm.envOr("PLATFORM_FEE_BPS", uint256(200));
        string memory baseURI = vm.envOr("BASE_URI", string("ipfs://base/"));
        // Optional: use existing core contracts if provided
        address registryAddr = vm.envOr("REGISTRY_ADDRESS", address(0));
        address subsAddr = vm.envOr("SUBSCRIPTION_MANAGER_ADDRESS", address(0));
        // Optional resolver address for AccessPass
        address resolver = vm.envOr("ACCESS_PASS_RESOLVER", address(0));
        // Optional: use an already-deployed AccessPass instead of deploying a new one
        address accessPassAddr = vm.envOr("ACCESS_PASS_ADDRESS", address(0));
        // Optional: creator payout to register owner as a creator (skipped if zero address)
        address creatorPayout = vm.envOr("CREATOR_PAYOUT", address(0));
        // Optional: sample metadata/operator wiring for the owner creator
        uint256 setAIFlag = vm.envOr("SAMPLE_SET_AI", uint256(0));
        string memory sampleHandle = vm.envOr("SAMPLE_HANDLE", string(""));
        address sampleOperator = vm.envOr("SAMPLE_OPERATOR", address(0));
        // Load network configuration for tokens/oracles
        NetworkConfig memory cfg = _loadNetworkConfig();
        // Optional: use an already-deployed Treasury instead of deploying a new one
        address treasuryAddr = vm.envOr("TREASURY_ADDRESS", address(0));
        // Optional: use an already-deployed SubscribeWithMax instead of deploying a new one
        address subscribeExtAddr = vm.envOr("SUBSCRIBE_EXTENSION_ADDRESS", address(0));
        // Optional: create a fixed-price sample tier if price > 0
        uint256 sampleFixedPrice = vm.envOr("SAMPLE_FIXED_PRICE_WEI", uint256(0));
        uint256 sampleFixedDuration = vm.envOr("SAMPLE_FIXED_DURATION", uint256(0));
        string memory sampleMetadata = vm.envOr("SAMPLE_TIER_METADATA", string("tier://sample"));
        // Optional: create an oracle-priced sample tier if usd price > 0
        uint256 sampleOracleUsd = vm.envOr("SAMPLE_ORACLE_USD_PRICE", uint256(0));
        uint256 sampleOracleDuration = vm.envOr("SAMPLE_ORACLE_DURATION", uint256(0));
        address sampleOracleToken = vm.envOr("SAMPLE_ORACLE_PAYMENT_TOKEN", address(0));
        address sampleOracleAgg = vm.envOr("SAMPLE_ORACLE_AGGREGATOR", address(0));
        uint256 sampleOracleTokenDecimals = vm.envOr("SAMPLE_ORACLE_TOKEN_DECIMALS", uint256(0));

        // Ensure the deployer is funded on local Anvil to avoid 'insufficient funds'
        if (block.chainid == 31337 && owner.balance < 10 ether) {
            vm.deal(owner, 100 ether);
        }

        vm.startBroadcast(pk);

        CreatorRegistry registry;
        SubscriptionManager subs;
        bool freshDeploy = (registryAddr == address(0) || subsAddr == address(0));

        if (freshDeploy) {
            registry = new CreatorRegistry(owner);
            subs = new SubscriptionManager(owner, ICreatorRegistry(address(registry)), platformTreasury, uint96(platformFeeBps));
        } else {
            registry = CreatorRegistry(registryAddr);
            address payable subsPayable = payable(subsAddr);
            subs = SubscriptionManager(subsPayable);
        }

        // AccessPass: only wire on fresh deployments to avoid ownership issues
        if (freshDeploy) {
            if (accessPassAddr == address(0)) {
                AccessPass pass = new AccessPass("AccessPass", "APASS", baseURI, owner);
                pass.setManager(address(subs));
                if (resolver != address(0)) {
                    pass.setResolver(resolver);
                }
                subs.setAccessPass(address(pass));
                accessPassAddr = address(pass);
            } else {
                subs.setAccessPass(accessPassAddr);
            }
        }

        // Optionally register owner as a creator with payout
        if (freshDeploy && creatorPayout != address(0)) {
            registry.registerCreator(owner, creatorPayout);
            // Optional creator metadata and operator provisioning
            if (setAIFlag > 0) {
                registry.setAIFor(owner, true);
            }
            if (bytes(sampleHandle).length > 0) {
                registry.setDisplayHandleFor(owner, sampleHandle);
            }
            if (sampleOperator != address(0)) {
                registry.addOperatorFor(owner, sampleOperator);
            }
        }

        // Wire Treasury helper: deploy on fresh, or set provided address when given
        if (freshDeploy) {
            Treasury tre = new Treasury(subs, owner);
            subs.setTreasury(address(tre));
            treasuryAddr = address(tre);
        } else if (treasuryAddr != address(0)) {
            subs.setTreasury(treasuryAddr);
        }

        // Wire SubscribeWithMax extension: deploy on fresh, or set provided address when given
        if (freshDeploy) {
            SubscribeWithMax ext = new SubscribeWithMax(subs);
            subs.setSubscribeExtension(address(ext));
            subscribeExtAddr = address(ext);
        } else if (subscribeExtAddr != address(0)) {
            subs.setSubscribeExtension(subscribeExtAddr);
        }

        // Optionally allowlist a token
        if (freshDeploy && cfg.allowToken != address(0)) {
            subs.setTokenAllowed(cfg.allowToken, true);
        }

        // Wire OracleConfigurator extension on fresh deployments
        OracleConfigurator config;
        if (freshDeploy) {
            config = new OracleConfigurator(subs, owner);
            subs.setOracleConfigurator(address(config));
        }

        // Optionally set default oracle for a token (including ETH with address(0)) via configurator
        if (freshDeploy && cfg.defaultOracle != address(0) && cfg.defaultTokenDecimals > 0) {
            config.setTokenOracleDefault(cfg.defaultToken, cfg.defaultOracle, uint8(cfg.defaultTokenDecimals));
        }

        // Optionally create a fixed tier for the owner (as creator)
        if (freshDeploy && sampleFixedPrice > 0 && sampleFixedDuration > 0 && registry.isCreator(owner)) {
            subs.createTier(sampleFixedPrice, uint64(sampleFixedDuration), sampleMetadata, address(0));
        }

        // Optionally create an oracle tier for the owner (as creator)
        if (freshDeploy && sampleOracleUsd > 0 && sampleOracleDuration > 0 && registry.isCreator(owner)) {
            subs.createTierOracle(
                sampleOracleUsd,
                uint64(sampleOracleDuration),
                sampleMetadata,
                sampleOracleToken,
                sampleOracleAgg,
                uint8(sampleOracleTokenDecimals)
            );
        }

        Marketplace market = new Marketplace(owner, owner, 200); // 2%

        // Example: deploy a collection for a creator (owner acts as creator here)
        GemToken gem = new GemToken("Gems", "GEM", baseURI, owner, 500, owner); // 5% royalty

        // Compute final addresses (works for both fresh and reuse deployments)
        address finalRegistry = address(registry);
        address finalSubs = address(subs);
        address finalAccessPass = subs.accessPass();
        address finalOracleConfigurator = freshDeploy ? address(config) : subs.oracleConfigurator();
        address finalTreasury = subs.treasuryExtension();
        address finalSubscribeExt = subs.subscribeExtension();
        address finalMarketplace = address(market);
        address finalGem = address(gem);

        vm.stopBroadcast();

        // Echo KEY=VALUE lines for contracts/.env consumption
        console2.log(string.concat("REGISTRY_ADDRESS=", vm.toString(finalRegistry)));
        console2.log(string.concat("SUBSCRIPTION_MANAGER_ADDRESS=", vm.toString(finalSubs)));
        // Alias for other scripts expecting SUBSCRIPTION_MANAGER
        console2.log(string.concat("SUBSCRIPTION_MANAGER=", vm.toString(finalSubs)));
        console2.log(string.concat("ACCESS_PASS_ADDRESS=", vm.toString(finalAccessPass)));
        console2.log(string.concat("ORACLE_CONFIGURATOR=", vm.toString(finalOracleConfigurator)));
        console2.log(string.concat("TREASURY_ADDRESS=", vm.toString(finalTreasury)));
        // Alias for scripts expecting TREASURY (without suffix)
        console2.log(string.concat("TREASURY=", vm.toString(finalTreasury)));
        console2.log(string.concat("SUBSCRIBE_EXTENSION_ADDRESS=", vm.toString(finalSubscribeExt)));
        console2.log(string.concat("MARKETPLACE_ADDRESS=", vm.toString(finalMarketplace)));
        console2.log(string.concat("GEM_TOKEN_ADDRESS=", vm.toString(finalGem)));
    }
}
