// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

// Mocks
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockERC20Permit} from "../src/mocks/MockERC20Permit.sol";
import {MockERC20NoReturn} from "../src/mocks/MockERC20NoReturn.sol";
import {MockDaiLikeERC20} from "../src/mocks/MockDaiLikeERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockAccessPass} from "../src/mocks/MockAccessPass.sol";
import {MockAccessPassResolver} from "../src/mocks/MockAccessPassResolver.sol";
import {ReentrantCreator} from "../src/mocks/ReentrantCreator.sol";

contract DeployMocks is Script {
    function _fundAnvilRecipients() internal {
        // Only fund on local anvil by convention
        if (block.chainid != 31337) return;

        uint256 amount = vm.envOr("FUND_AMOUNT_WEI", uint256(10 ether));
        // Optionally provide up to 10 addresses via FUND_ADDR_1..FUND_ADDR_10
        for (uint256 i = 1; i <= 10; i++) {
            string memory key = string.concat("FUND_ADDR_", vm.toString(i));
            address recipient = vm.envOr(key, address(0));
            if (recipient == address(0)) continue;
            // Top-up style: add amount to current balance
            uint256 target = recipient.balance + amount;
            vm.deal(recipient, target);
            console2.log(string.concat("FUNDED_", vm.toString(i), "=", vm.toString(recipient)));
        }

        // Or provide up to 10 private keys via FUND_PK_1..FUND_PK_10
        for (uint256 i = 1; i <= 10; i++) {
            string memory key = string.concat("FUND_PK_", vm.toString(i));
            uint256 pk = vm.envOr(key, uint256(0));
            if (pk == 0) continue;
            address recipient = vm.addr(pk);
            uint256 target = recipient.balance + amount;
            vm.deal(recipient, target);
            console2.log(string.concat("FUNDED_PK_", vm.toString(i), "=", vm.toString(recipient)));
        }
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // Ensure deployer has gas on anvil
        if (block.chainid == 31337 && deployer.balance < 100 ether) {
            vm.deal(deployer, 1_000 ether);
        }

        vm.startBroadcast(pk);

        // Deploy mocks
        MockERC20 erc20 = new MockERC20("MockToken", "MOCK");
        MockERC20Permit erc20Permit = new MockERC20Permit("MockPermit", "MPERMIT");
        MockERC20NoReturn erc20NoRet = new MockERC20NoReturn("MockNoRet", "MNRT");
        MockDaiLikeERC20 dai = new MockDaiLikeERC20("MockDai", "mDAI");

        uint8 oracleDecimals = uint8(vm.envOr("MOCK_ORACLE_DECIMALS", uint256(8)));
        // Default price = 3000 * 10^decimals
        uint256 defaultPrice = 3000 * (10 ** uint256(oracleDecimals));
        int256 oracleAnswer = int256(vm.envOr("MOCK_ORACLE_PRICE", defaultPrice));
        MockOracle oracle = new MockOracle(oracleDecimals, oracleAnswer, block.timestamp);

        MockAccessPass pass = new MockAccessPass();
        MockAccessPassResolver resolver = new MockAccessPassResolver();

        // Optional ReentrantCreator wiring (requires TREASURY_ADDRESS and SUBSCRIPTION_MANAGER_ADDRESS)
        address tre = vm.envOr("TREASURY_ADDRESS", address(0));
        address subs = vm.envOr("SUBSCRIPTION_MANAGER_ADDRESS", address(0));
        address reentrantCreatorAddr = address(0);
        if (tre != address(0) && subs != address(0)) {
            ReentrantCreator re = new ReentrantCreator(tre, subs);
            reentrantCreatorAddr = address(re);
        }

        vm.stopBroadcast();

        // Fund anvil recipients after deployment
        _fundAnvilRecipients();

        // Echo addresses as KEY=VALUE for easy consumption
        console2.log(string.concat("DEPLOYER=", vm.toString(deployer)));
        console2.log(string.concat("MOCK_ERC20=", vm.toString(address(erc20))));
        console2.log(string.concat("MOCK_ERC20_PERMIT=", vm.toString(address(erc20Permit))));
        console2.log(string.concat("MOCK_ERC20_NO_RETURN=", vm.toString(address(erc20NoRet))));
        console2.log(string.concat("MOCK_DAI_LIKE=", vm.toString(address(dai))));
        console2.log(string.concat("MOCK_ORACLE=", vm.toString(address(oracle))));
        console2.log(string.concat("MOCK_ACCESS_PASS=", vm.toString(address(pass))));
        console2.log(string.concat("MOCK_ACCESS_PASS_RESOLVER=", vm.toString(address(resolver))));
        console2.log(string.concat("REENTRANT_CREATOR=", vm.toString(reentrantCreatorAddr)));
    }
}
