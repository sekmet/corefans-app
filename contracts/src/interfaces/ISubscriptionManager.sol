// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISubscriptionManager {
    function hasActiveSubscription(address user, address creator) external view returns (bool);
}
