// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SubscriptionManager} from "./SubscriptionManager.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

interface IDaiLikePermit {
    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
}

/// @title SubscribeWithMax
/// @notice Extension that provides slippage-protected subscribe variants, extracted from SubscriptionManager
contract SubscribeWithMax {
    SubscriptionManager public immutable subs;

    error Slippage();
    error NotEthTier();
    error NotErc20Tier();
    error InvalidPaymentAmount();

    constructor(SubscriptionManager _subs) {
        subs = _subs;
    }

    /// @notice Quote the current required payment amount for a creator/tier using manager state
    function quote(address creator, uint256 tierId) public view returns (uint256 amount, address paymentToken) {
        // Read tier info from manager
        (uint256 price, , , , address token, bool _deleted) = subs.tiers(creator, tierId);
        paymentToken = token;
        // If tier uses oracle, compute from oracle config; otherwise fixed price
        if (subs.tierUsesOracle(creator, tierId)) {
            (address oracle, uint8 tokenDecimals, uint256 usdPrice) = subs.tierOracleConfig(creator, tierId);
            (, int256 answer, , , ) = IPriceOracle(oracle).latestRoundData();
            // Best-effort quote; rely on manager for strict validation
            uint256 denom = uint256(answer);
            uint256 numer = usdPrice * (10 ** tokenDecimals);
            amount = denom == 0 ? 0 : (numer / denom);
        } else {
            amount = price;
        }
    }

    /// @notice ETH subscribe with slippage protection (for oracle or fixed ETH tiers)
    function subscribeEthWithMax(address creator, uint256 tierId, uint256 maxAmount) external payable {
        // Forward ETH and parameters; manager will resolve quote and enforce slippage and value checks
        subs.subscribeWithMaxRaw{value: msg.value}(msg.sender, creator, tierId, maxAmount);
    }

    /// @notice ERC20 subscribe with slippage protection (requires prior approve to manager)
    function subscribeWithMax(address creator, uint256 tierId, uint256 maxAmount) external {
        subs.subscribeWithMaxRaw(msg.sender, creator, tierId, maxAmount);
    }

    /// @notice ERC20 subscribe using DAI-like permit signature to set allowance, then forward to manager raw entrypoint
    function subscribeWithDaiPermit(
        address creator,
        uint256 tierId,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Read token from tier
        ( , , , , address token, ) = subs.tiers(creator, tierId);
        if (token == address(0)) revert NotErc20Tier();

        // Approve via DAI-like permit (to SubscriptionManager)
        IDaiLikePermit(token).permit(msg.sender, address(subs), nonce, expiry, allowed, v, r, s);

        // Forward to manager raw path; no slippage cap -> use max uint
        subs.subscribeWithMaxRaw(msg.sender, creator, tierId, type(uint256).max);
    }
}
