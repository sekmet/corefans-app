// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {SubscriptionManager} from "./SubscriptionManager.sol";

/// @title OracleConfigurator
/// @notice Externalizes oracle configuration to reduce SubscriptionManager bytecode size
contract OracleConfigurator is Ownable {
    SubscriptionManager public immutable subs;

    constructor(SubscriptionManager _subs, address initialOwner) Ownable(initialOwner) {
        subs = _subs;
    }

    /// @notice Set default oracle per payment token (address(0) for ETH)
    function setTokenOracleDefault(address token, address oracle, uint8 tokenDecimals) external onlyOwner {
        subs.setTokenOracleDefaultRaw(token, oracle, tokenDecimals);
    }

    /// @notice Creator-facing: set/rotate oracle config for a tier
    /// If oracle is zero, manager will fallback to token default; if decimals zero, defaults are used.
    function setTierOracleConfig(uint256 tierId, address oracle, uint8 tokenDecimals, uint256 usdPrice) external {
        subs.setTierOracleConfigRaw(msg.sender, tierId, oracle, tokenDecimals, usdPrice);
    }

    /// @notice Owner emergency: rotate a creator's tier oracle config
    function ownerSetTierOracleConfig(address creator, uint256 tierId, address oracle, uint8 tokenDecimals, uint256 usdPrice)
        external
        onlyOwner
    {
        subs.setTierOracleConfigRaw(creator, tierId, oracle, tokenDecimals, usdPrice);
    }
}
