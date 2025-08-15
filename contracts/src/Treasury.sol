// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {SubscriptionManager} from "./SubscriptionManager.sol";

/// @title Treasury helper for SubscriptionManager withdrawals
/// @notice Thin wrapper that exposes creator/platform withdrawal entrypoints and
///         delegates to SubscriptionManager raw hooks. Keeps core logic and
///         state in SubscriptionManager while shrinking its public surface.
contract Treasury is Ownable, ReentrancyGuard {
    SubscriptionManager public immutable subs;

    constructor(SubscriptionManager _subs, address initialOwner) Ownable(initialOwner) {
        subs = _subs;
    }

    // ============ Creator withdrawals ============

    /// @notice Withdraw creator funds to caller
    function withdrawCreator(address token) external nonReentrant {
        subs.withdrawCreatorToRaw(msg.sender, token, msg.sender);
    }

    /// @notice Withdraw creator funds to a specific destination
    function withdrawCreatorTo(address token, address dst) external nonReentrant {
        subs.withdrawCreatorToRaw(msg.sender, token, dst);
    }

    /// @notice Withdraw creator funds to registry-configured payout address
    function withdrawCreatorToPayout(address token) external nonReentrant {
        subs.withdrawCreatorToPayoutRaw(msg.sender, token);
    }

    // ============ Platform withdrawals ============

    /// @notice Withdraw platform fees to the platform treasury address configured in SubscriptionManager
    /// @dev Authorization is enforced in SubscriptionManager against msg.sender via the `caller` param
    function withdrawPlatform(address token) external nonReentrant {
        subs.withdrawPlatformRaw(msg.sender, token);
    }
}
