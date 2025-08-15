// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {ICreatorRegistry} from "./interfaces/ICreatorRegistry.sol";
import {ISubscriptionManager} from "./interfaces/ISubscriptionManager.sol";

contract TipJar is Ownable, Pausable, ReentrancyGuard {
    ICreatorRegistry public immutable registry;
    ISubscriptionManager public immutable subs;

    address public platformTreasury;
    uint96 public platformFeeBps; // e.g., 200 = 2%

    // Optional: require active subscription for tipping
    bool public subscriberOnly;

    // creator => token => amount; token == address(0) for ETH
    mapping(address => mapping(address => uint256)) public creatorBalanceByToken;
    // token => amount
    mapping(address => uint256) public platformBalanceByToken;

    event PlatformFeeUpdated(uint96 bps);
    event PlatformTreasuryUpdated(address treasury);
    event SubscriberOnlyUpdated(bool enabled);

    event Tipped(
        address indexed user,
        address indexed creator,
        address indexed token,
        uint256 amount,
        uint256 platformFee
    );
    event CreatorWithdrawn(address indexed creator, address indexed token, uint256 amount);
    event PlatformWithdrawn(address indexed treasury, address indexed token, uint256 amount);

    constructor(
        address initialOwner,
        ICreatorRegistry _registry,
        address _subs,
        address _platformTreasury,
        uint96 _platformFeeBps
    ) Ownable(initialOwner) {
        require(address(_registry) != address(0) && address(_subs) != address(0), "zero");
        require(_platformTreasury != address(0), "treasury");
        registry = _registry;
        subs = ISubscriptionManager(_subs);
        platformTreasury = _platformTreasury;
        platformFeeBps = _platformFeeBps;
    }

    function setPlatformFeeBps(uint96 bps) external onlyOwner {
        require(bps <= 2000, "fee too high"); // 20% cap
        platformFeeBps = bps;
        emit PlatformFeeUpdated(bps);
    }

    function setPlatformTreasury(address t) external onlyOwner {
        require(t != address(0), "zero");
        platformTreasury = t;
        emit PlatformTreasuryUpdated(t);
    }

    function setSubscriberOnly(bool on) external onlyOwner {
        subscriberOnly = on;
        emit SubscriberOnlyUpdated(on);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Tipping ---
    function tipETH(address creator) external payable nonReentrant whenNotPaused {
        require(registry.isCreator(creator), "invalid creator");
        if (subscriberOnly) {
            require(subs.hasActiveSubscription(msg.sender, creator), "not subscriber");
        }
        require(msg.value > 0, "zero value");
        (uint256 toCreator, uint256 toPlatform) = _split(msg.value);
        creatorBalanceByToken[creator][address(0)] += toCreator;
        platformBalanceByToken[address(0)] += toPlatform;
        emit Tipped(msg.sender, creator, address(0), msg.value, toPlatform);
    }

    function tipERC20(address creator, address token, uint256 amount) external nonReentrant whenNotPaused {
        require(registry.isCreator(creator), "invalid creator");
        if (subscriberOnly) {
            require(subs.hasActiveSubscription(msg.sender, creator), "not subscriber");
        }
        require(token != address(0) && amount > 0, "invalid token/amount");
        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");
        (uint256 toCreator, uint256 toPlatform) = _split(amount);
        creatorBalanceByToken[creator][token] += toCreator;
        platformBalanceByToken[token] += toPlatform;
        emit Tipped(msg.sender, creator, token, amount, toPlatform);
    }

    function _split(uint256 amount) internal view returns (uint256 toCreator, uint256 toPlatform) {
        uint256 fee = (amount * platformFeeBps) / 10_000;
        toPlatform = fee;
        toCreator = amount - fee;
    }

    // --- Withdrawals ---
    function withdrawCreator(address token) external nonReentrant {
        require(registry.isCreator(msg.sender), "not creator");
        uint256 amt = creatorBalanceByToken[msg.sender][token];
        require(amt > 0, "none");
        creatorBalanceByToken[msg.sender][token] = 0;
        if (token == address(0)) {
            (bool s, ) = msg.sender.call{value: amt}("");
            require(s, "eth send");
        } else {
            bool ok = IERC20(token).transfer(msg.sender, amt);
            require(ok, "erc20 send");
        }
        emit CreatorWithdrawn(msg.sender, token, amt);
    }

    function withdrawPlatform(address token) external nonReentrant {
        uint256 amt = platformBalanceByToken[token];
        require(amt > 0, "none");
        platformBalanceByToken[token] = 0;
        if (token == address(0)) {
            (bool s, ) = platformTreasury.call{value: amt}("");
            require(s, "eth send");
        } else {
            bool ok = IERC20(token).transfer(platformTreasury, amt);
            require(ok, "erc20 send");
        }
        emit PlatformWithdrawn(platformTreasury, token, amt);
    }
}
