// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SubscriptionManager.sol";

/// @title SubscriptionViews
/// @notice Read-only pagination helpers extracted from SubscriptionManager to reduce core bytecode size
contract SubscriptionViews {
    SubscriptionManager public immutable subs;

    constructor(SubscriptionManager _subs) {
        subs = _subs;
    }

    function getSubscribersPage(
        address creator,
        uint256 start,
        uint256 limit
    ) external view returns (address[] memory page, uint256 next) {
        uint256 n = subs.creatorSubscribersLength(creator);
        if (start >= n) {
            return (new address[](0), start);
        }
        uint256 end = start + limit;
        if (end > n) end = n;
        uint256 size = end - start;
        page = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = subs.creatorSubscriberAt(creator, start + i);
        }
        next = end;
    }

    function getActiveSubscribersPage(
        address creator,
        uint256 start,
        uint256 limit
    ) external view returns (address[] memory page, uint256 next) {
        uint256 n = subs.creatorSubscribersLength(creator);
        if (start >= n) {
            return (new address[](0), start);
        }
        page = new address[](limit);
        uint256 count;
        uint256 i = start;
        while (i < n && count < limit) {
            address u = subs.creatorSubscriberAt(creator, i);
            if (subs.hasActiveSubscription(u, creator)) {
                page[count++] = u;
            }
            unchecked {
                i++;
            }
        }
        // shrink array length to actual count
        assembly {
            mstore(page, count)
        }
        next = i;
    }
}
