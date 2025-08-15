// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    function withdrawCreator(address token) external;
}

interface ISubsCore {
    function createTier(
        uint256 price,
        uint64 duration,
        string calldata metadataURI,
        address paymentToken
    ) external returns (uint256);
}

// Acts as a creator that re-enters withdrawCreator on receiving ETH
contract ReentrantCreator {
    ITreasury public tre;
    ISubsCore public subs;

    constructor(address tre_, address subs_) {
        tre = ITreasury(tre_);
        subs = ISubsCore(subs_);
    }

    receive() external payable {
        // Attempt to reenter
        try tre.withdrawCreator(address(0)) {
            // should not reach, expect reentrancy guard to revert
        } catch {}
    }

    // Helper to create a tier as the creator contract
    function createEthTier(uint256 priceWei, uint64 duration, string calldata uri) external returns (uint256) {
        return subs.createTier(priceWei, duration, uri, address(0));
    }

    // Helper to trigger withdraw from this contract (as creator)
    function doWithdrawCreator(address token) external {
        tre.withdrawCreator(token);
    }
}
