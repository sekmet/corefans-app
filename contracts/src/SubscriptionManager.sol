// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ICreatorRegistry} from "./interfaces/ICreatorRegistry.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IAccessPass} from "./interfaces/IAccessPass.sol";

// AccessPass interface is imported from interfaces/IAccessPass.sol


// Custom errors to reduce bytecode size (EIP-170 mitigation)
error InvalidCreator();
error InvalidTier();
error NotErc20Tier();
error NotEthTier();
error OracleInvalid();
error OracleFuture();
error OracleStale();
error AmountZero();
error ERC20TransferFailed();
error ZeroAddress();
error NotCreator();
error NotOperator();
error FeeTooHigh();
error InvalidPrice();
error InvalidDuration();
error TokenNotAllowed();
error OracleZero();
error DecimalsZero();
error TierOutOfBounds();
error TierIsDeleted();
error UnexpectedEth();
error Slippage();
error UseZeroForETH();
error StartOutOfBounds();
error InvalidPaymentAmount();
error EthTransferFailed();
error NotTreasuryOrOwner();
error PermitTooLow();

contract SubscriptionManager is Ownable, Pausable, ReentrancyGuard {
    uint256 public constant ORACLE_STALE_AFTER = 2 hours;
    bytes4 private constant SELECTOR_UPDATE_ON_RENEW_WITH_TIER = bytes4(keccak256("updateOnRenewWithTier(address,address,uint64,uint256)"));
    struct Tier {
        uint256 price;       // price in smallest units of paymentToken (wei for ETH) if not using oracle
        uint64 duration;     // in seconds
        string metadataURI;  // description/display
        bool active;
        address paymentToken; // address(0) for ETH, else ERC20
        bool deleted;         // soft-delete flag; deleted tiers cannot be reactivated
    }


    // Minimal getters to support external view modules (e.g., SubscriptionViews.sol)
    function creatorSubscribersLength(address creator) external view returns (uint256) {
        return _creatorSubscribers[creator].length;
    }

    function creatorSubscriberAt(address creator, uint256 index) external view returns (address) {
        return _creatorSubscribers[creator][index];
    }
    struct OracleConfig {
        address oracle;      // Chainlink-like aggregator for token/USD
        uint8 tokenDecimals; // decimals for payment token (18 for ETH or ERC20 decimals)
        uint256 usdPrice;    // price in 1e8 USD units (Chainlink convention)
    }

    uint96 public platformFeeBps; // e.g., 200 = 2%
    ICreatorRegistry public immutable registry;
    address public platformTreasury;
    address public accessPass; // optional access pass hook
    // extension roles
    address public oracleConfigurator; // contract allowed to manage oracle configs
    address public treasuryExtension; // contract allowed to perform withdrawals
    address public subscribeExtension; // contract allowed to call slippage-protected raw subscribe

    // optional per-creator configurations
    // creator-specific grace period (in seconds) to consider subscription active after expiry
    mapping(address => uint64) public creatorGracePeriod;
    // creator-specific platform fee cap (in bps). If set to a value lower than global platformFeeBps,
    // the lower value is used when computing fees for that creator.
    mapping(address => uint96) public creatorFeeCapBps;

    // creator => tiers
    mapping(address => Tier[]) public tiers;
    // oracle config per creator tier
    mapping(address => mapping(uint256 => bool)) public tierUsesOracle;
    mapping(address => mapping(uint256 => OracleConfig)) public tierOracleConfig;

    // user => creator => expiresAt
    mapping(address => mapping(address => uint64)) public subscriptionExpiry;

    // enumeration helpers: known subscribers per creator (append-only)
    mapping(address => address[]) private _creatorSubscribers;
    mapping(address => mapping(address => bool)) private _isKnownSubscriber; // creator => user => known
    // user-centric reverse index for gating views
    mapping(address => address[]) private _userCreators; // user => creators ever subscribed to
    mapping(address => mapping(address => bool)) private _isKnownCreatorForUser; // user => creator => known

    // balances keyed by token: address(0) for ETH
    // creator => token => amount
    mapping(address => mapping(address => uint256)) public creatorBalanceByToken;
    // token => amount
    mapping(address => uint256) public platformBalanceByToken;

    // allowlist of ERC20 tokens; address(0) implicitly allowed for ETH
    mapping(address => bool) public allowedTokens;

    // renewal mode per creator: whether early renewals extend from current expiry or reset from now
    enum RenewalMode { Extend, Reset }
    mapping(address => RenewalMode) public creatorRenewalMode; // default = Extend (enum zero)

    event TierCreated(address indexed creator, uint256 indexed tierId, uint256 price, uint64 duration, string metadataURI, address paymentToken);
    event Subscribed(address indexed user, address indexed creator, uint256 indexed tierId, uint64 expiresAt, uint256 amount, address paymentToken);
    event PlatformFeeUpdated(uint96 bps);
    event PlatformTreasuryUpdated(address treasury);
    event AccessPassUpdated(address accessPass);

    // new/refined events
    event TokenAllowlistUpdated(address indexed token, bool allowed);
    event CreatorWithdrawn(address indexed creator, address indexed token, uint256 amount);
    event PlatformWithdrawn(address indexed treasury, address indexed token, uint256 amount);

    // oracle and config events
    event TierOracleUpdated(
        address indexed creator,
        uint256 indexed tierId,
        address oracle,
        uint8 tokenDecimals,
        uint256 usdPrice
    );
    // lifecycle and config events
    event TierDeleted(address indexed creator, uint256 indexed tierId);
    event CreatorGracePeriodUpdated(address indexed creator, uint64 graceSeconds);
    event CreatorFeeCapUpdated(address indexed creator, uint96 feeCapBps);
    event TokenOracleDefaultUpdated(address indexed token, address indexed oracle, uint8 tokenDecimals);
    event CreatorRenewalModeUpdated(address indexed creator, RenewalMode mode);

    // default oracle registry per payment token/network
    struct TokenOracleDefault { address oracle; uint8 tokenDecimals; }
    mapping(address => TokenOracleDefault) public tokenOracleDefaults; // token => default

    constructor(address initialOwner, ICreatorRegistry _registry, address _treasury, uint96 _platformFeeBps)
        Ownable(initialOwner)
    {
        if (address(_registry) == address(0) || _treasury == address(0)) revert ZeroAddress();
        registry = _registry;
        platformTreasury = _treasury;
        platformFeeBps = _platformFeeBps;
    }

    modifier onlyOracleConfigurator() {
        _onlyOracleConfigurator();
        _;
    }
    function _onlyOracleConfigurator() internal view {
        if (msg.sender != oracleConfigurator) revert NotOperator(); // reuse NotOperator for role violation
    }

    modifier onlyCreator() {
        _onlyCreator();
        _;
    }
    function _onlyCreator() internal view {
        if (!registry.isCreator(msg.sender)) revert NotCreator();
    }

    // Allow either the creator themself or one of their operators to act
    modifier onlyCreatorOrOperator(address creator) {
        _onlyCreatorOrOperator(creator);
        _;
    }
    function _onlyCreatorOrOperator(address creator) internal view {
        if (msg.sender == creator) {
            if (!registry.isCreator(creator)) revert NotCreator();
        } else {
            if (!registry.isOperator(creator, msg.sender)) revert NotOperator();
        }
    }

    modifier onlyTreasury() {
        _onlyTreasury();
        _;
    }
    function _onlyTreasury() internal view {
        if (msg.sender != treasuryExtension) revert NotOperator();
    }

    modifier onlySubscribeExtension() {
        _onlySubscribeExtension();
        _;
    }
    function _onlySubscribeExtension() internal view {
        if (msg.sender != subscribeExtension) revert NotOperator();
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setPlatformFeeBps(uint96 bps) external onlyOwner {
        if (bps > 2000) revert FeeTooHigh(); // 20% cap
        platformFeeBps = bps;
        emit PlatformFeeUpdated(bps);
    }

    function setPlatformTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        platformTreasury = t;
        emit PlatformTreasuryUpdated(t);
    }

    function setAccessPass(address _accessPass) external onlyOwner {
        accessPass = _accessPass; // allow zero to disable
        emit AccessPassUpdated(_accessPass);
    }

    // Wire up extension addresses
    function setOracleConfigurator(address c) external onlyOwner {
        if (c == address(0)) revert ZeroAddress();
        oracleConfigurator = c;
    }

    // Wire up Treasury extension responsible for withdrawals
    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        treasuryExtension = t;
    }

    // Wire up Subscribe extension responsible for slippage-protected paths
    function setSubscribeExtension(address e) external onlyOwner {
        if (e == address(0)) revert ZeroAddress();
        subscribeExtension = e;
    }

    // Configure renewal mode for early renewals
    function setCreatorRenewalMode(RenewalMode mode) external onlyCreator whenNotPaused {
        creatorRenewalMode[msg.sender] = mode;
        emit CreatorRenewalModeUpdated(msg.sender, mode);
    }

    // operator-enabled variant
    

    function createTier(uint256 price, uint64 duration, string calldata metadataURI, address paymentToken)
        external
        onlyCreator
        whenNotPaused
        returns (uint256 tierId)
    {
        if (price == 0) revert InvalidPrice();
        tierId = _createTierFor(msg.sender, price, duration, metadataURI, paymentToken);
    }

    

    function _createTierFor(address creator, uint256 price, uint64 duration, string calldata metadataURI, address paymentToken)
        internal
        returns (uint256 tierId)
    {
        if (duration == 0) revert InvalidDuration();
        if (paymentToken != address(0)) {
            if (!allowedTokens[paymentToken]) revert TokenNotAllowed();
        }
        Tier memory t = Tier({price: price, duration: duration, metadataURI: metadataURI, active: true, paymentToken: paymentToken, deleted: false});
        tiers[creator].push(t);
        tierId = tiers[creator].length - 1;
        emit TierCreated(creator, tierId, price, duration, metadataURI, paymentToken);
    }

    // oracle-aware tier creation
    function createTierOracle(
        uint256 usdPrice,
        uint64 duration,
        string calldata metadataURI,
        address paymentToken,
        address oracle,
        uint8 tokenDecimals
    ) external onlyCreator whenNotPaused returns (uint256 tierId) {
        tierId = _createTierOracleFor(msg.sender, usdPrice, duration, metadataURI, paymentToken, oracle, tokenDecimals);
    }

    

    function _createTierOracleFor(
        address creator,
        uint256 usdPrice,
        uint64 duration,
        string calldata metadataURI,
        address paymentToken,
        address oracle,
        uint8 tokenDecimals
    ) internal returns (uint256 tierId) {
        if (duration == 0) revert InvalidDuration();
        if (usdPrice == 0) revert InvalidPrice();
        if (paymentToken != address(0)) {
            if (!allowedTokens[paymentToken]) revert TokenNotAllowed();
        }
        // First create the tier to avoid holding many locals during string storage write
        tierId = _createTierFor(creator, 0, duration, metadataURI, paymentToken);
        // Then resolve/default and apply oracle config
        _applyTierOracleConfig(creator, tierId, paymentToken, oracle, tokenDecimals, usdPrice);
    }

    function _applyTierOracleConfig(
        address creator,
        uint256 tierId,
        address paymentToken,
        address oracle,
        uint8 tokenDecimals,
        uint256 usdPrice
    ) internal {
        address useOracle = oracle;
        uint8 useDecimals = tokenDecimals;
        if (useOracle == address(0)) {
            TokenOracleDefault memory defo = tokenOracleDefaults[paymentToken];
            if (defo.oracle == address(0)) revert OracleZero();
            useOracle = defo.oracle;
            if (useDecimals == 0) useDecimals = defo.tokenDecimals;
        }
        if (useDecimals == 0) revert DecimalsZero();
        tierUsesOracle[creator][tierId] = true;
        tierOracleConfig[creator][tierId] = OracleConfig({
            oracle: useOracle,
            tokenDecimals: useDecimals,
            usdPrice: usdPrice
        });
        emit TierOracleUpdated(creator, tierId, useOracle, useDecimals, usdPrice);
    }

    // Raw hooks for oracle configuration (callable only by OracleConfigurator extension)
    function setTokenOracleDefaultRaw(address token, address oracle, uint8 tokenDecimals_) external onlyOracleConfigurator {
        if (oracle == address(0)) revert OracleZero();
        if (tokenDecimals_ == 0) revert DecimalsZero();
        tokenOracleDefaults[token] = TokenOracleDefault({oracle: oracle, tokenDecimals: tokenDecimals_});
        emit TokenOracleDefaultUpdated(token, oracle, tokenDecimals_);
    }

    // Removed setTierOracleConfigUseDefault* to reduce bytecode size

    // Removed updateTierOracle* to reduce bytecode size

    function _updateTierNonPriceFields(
        address creator,
        uint256 tierId,
        uint64 duration,
        string calldata metadataURI,
        address paymentToken
    ) internal {
        if (!(tierId < tiers[creator].length)) revert TierOutOfBounds();
        if (tiers[creator][tierId].deleted) revert TierIsDeleted();
        if (duration == 0) revert InvalidDuration();
        if (paymentToken != address(0)) {
            if (!allowedTokens[paymentToken]) revert TokenNotAllowed();
        }
        Tier storage t = tiers[creator][tierId];
        t.duration = duration;
        t.metadataURI = metadataURI;
        t.paymentToken = paymentToken;
        
    }

    // Apply oracle config for an arbitrary creator/tier controlled by extension
    function setTierOracleConfigRaw(
        address creator,
        uint256 tierId,
        address oracle,
        uint8 tokenDecimals,
        uint256 usdPrice
    ) external onlyOracleConfigurator {
        if (!(tierId < tiers[creator].length)) revert TierOutOfBounds();
        if (usdPrice == 0) revert InvalidPrice();
        address paymentToken = tiers[creator][tierId].paymentToken;
        _applyTierOracleConfig(creator, tierId, paymentToken, oracle, tokenDecimals, usdPrice);
    }

    // Owner emergency method to rotate a creator's tier oracle config
    // Removed ownerSetTierOracleConfig to reduce bytecode size

    function hasActiveSubscription(address user, address creator) external view returns (bool) {
        uint64 exp = subscriptionExpiry[user][creator];
        uint64 grace = creatorGracePeriod[creator];
        return exp + grace >= uint64(block.timestamp);
    }

    // Returns true if the user has any active subscription across any creators they have subscribed to before
    function hasAnyActiveSubscription(address user) external view returns (bool) {
        address[] storage creators = _userCreators[user];
        uint256 n = creators.length;
        for (uint256 i = 0; i < n; i++) {
            address c = creators[i];
            uint64 exp = subscriptionExpiry[user][c];
            uint64 grace = creatorGracePeriod[c];
            if (exp + grace >= uint64(block.timestamp)) {
                return true;
            }
        }
        return false;
    }

    // view helper: number of tiers for a creator
    function tiersLength(address creator) external view returns (uint256) {
        return tiers[creator].length;
    }

    // removed getActiveTiers to reduce runtime size; clients can page via getTiersPage and filter off-chain

    // view helper: balances for UI
    

    // owner: manage ERC20 token allowlist (address(0) reserved for ETH)
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert UseZeroForETH();
        allowedTokens[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    // creator controls
    function setTierActive(uint256 tierId, bool active) external onlyCreator {
        _setTierActiveFor(msg.sender, tierId, active);
    }
    
    function _setTierActiveFor(address creator, uint256 tierId, bool active) internal {
        if (!(tierId < tiers[creator].length)) revert TierOutOfBounds();
        if (tiers[creator][tierId].deleted) revert TierIsDeleted();
        tiers[creator][tierId].active = active;
    }

    // Soft delete a tier permanently. Deleted tiers cannot be reactivated or subscribed to.
    function deleteTier(uint256 tierId) external onlyCreator whenNotPaused {
        _deleteTierFor(msg.sender, tierId);
    }
    
    function _deleteTierFor(address creator, uint256 tierId) internal {
        if (!(tierId < tiers[creator].length)) revert TierOutOfBounds();
        Tier storage t = tiers[creator][tierId];
        t.active = false;
        t.deleted = true;
        emit TierDeleted(creator, tierId);
    }

    function updateTier(uint256 tierId, uint256 price, uint64 duration, string calldata metadataURI, address paymentToken)
        external
        onlyCreator
        whenNotPaused
    {
        _updateTierFor(msg.sender, tierId, price, duration, metadataURI, paymentToken);
    }
    
    function _updateTierFor(address creator, uint256 tierId, uint256 price, uint64 duration, string calldata metadataURI, address paymentToken) internal {
        if (!(tierId < tiers[creator].length)) revert TierOutOfBounds();
        if (tiers[creator][tierId].deleted) revert TierIsDeleted();
        if (price == 0) revert InvalidPrice();
        if (duration == 0) revert InvalidDuration();
        if (paymentToken != address(0)) {
            if (!allowedTokens[paymentToken]) revert TokenNotAllowed();
        }
        Tier storage t = tiers[creator][tierId];
        t.price = price;
        t.duration = duration;
        t.metadataURI = metadataURI;
        t.paymentToken = paymentToken;
        
    }

    // view helpers
    

    // removed getTiers and getTierWithOracle to reduce runtime size; use individual getters and public mappings instead

    // Pagination helper for tiers
    

    function _resolveAmount(address creator, uint256 tierId, Tier memory t) internal view returns (uint256 amount) {
        if (tierUsesOracle[creator][tierId]) {
            OracleConfig memory oc = tierOracleConfig[creator][tierId];
            (, int256 answer, , uint256 updatedAt, ) = IPriceOracle(oc.oracle).latestRoundData();
            if (answer <= 0) revert OracleInvalid();
            if (updatedAt > block.timestamp) revert OracleFuture();
            if (block.timestamp - updatedAt > ORACLE_STALE_AFTER) revert OracleStale();
            uint256 denom = uint256(answer);
            uint256 numer = oc.usdPrice * (10 ** oc.tokenDecimals);
            amount = numer / denom;
            if (amount == 0) revert AmountZero();
        } else {
            amount = t.price;
        }
    }

    function _loadActiveTier(address creator, uint256 tierId) internal view returns (Tier memory t) {
        if (!registry.isCreator(creator)) revert InvalidCreator();
        if (!(tierId < tiers[creator].length && tiers[creator][tierId].active && !tiers[creator][tierId].deleted)) revert InvalidTier();
        t = tiers[creator][tierId];
    }

    function subscribe(address creator, uint256 tierId) external payable nonReentrant whenNotPaused {
        Tier memory t = _loadActiveTier(creator, tierId);

        uint256 amount;
        address token = t.paymentToken; // zero means ETH

        amount = _resolveAmount(creator, tierId, t);

        if (token == address(0)) {
            if (msg.value != amount) revert InvalidPaymentAmount();
        } else {
            if (msg.value != 0) revert UnexpectedEth();
            bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
            if (!ok) revert ERC20TransferFailed();
        }

        _processSubscription(msg.sender, creator, tierId, amount, token);
    }

    

    // Raw slippage-protected subscribe (callable only by Subscribe extension)
    // Handles both ETH and ERC20 tiers; uses `payer` as the logical user being charged.
    function subscribeWithMaxRaw(address payer, address creator, uint256 tierId, uint256 maxAmount)
        external
        payable
        onlySubscribeExtension
        nonReentrant
        whenNotPaused
    {
        Tier memory t = _loadActiveTier(creator, tierId);
        address token = t.paymentToken; // zero means ETH
        uint256 amount = _resolveAmount(creator, tierId, t);

        if (amount > maxAmount) revert Slippage();

        if (token == address(0)) {
            if (msg.value != amount) revert InvalidPaymentAmount();
            _processSubscription(payer, creator, tierId, amount, address(0));
        } else {
            if (msg.value != 0) revert UnexpectedEth();
            bool ok = IERC20(token).transferFrom(payer, address(this), amount);
            if (!ok) revert ERC20TransferFailed();
            _processSubscription(payer, creator, tierId, amount, token);
        }
    }

    function _processSubscription(address payer, address creator, uint256 tierId, uint256 amount, address token) internal {
        uint96 bps = platformFeeBps;
        uint96 cap = creatorFeeCapBps[creator];

        if (cap != 0 && cap < bps) {
            bps = cap;
        }
        uint256 platformCut = (amount * bps) / 10_000;
        uint256 creatorCut = amount - platformCut;
        platformBalanceByToken[token] += platformCut;
        creatorBalanceByToken[creator][token] += creatorCut;

        uint64 current = subscriptionExpiry[payer][creator];
        uint64 start;
        if (creatorRenewalMode[creator] == RenewalMode.Extend) {
            start = current > uint64(block.timestamp) ? current : uint64(block.timestamp);
        } else {
            // Reset mode: early renewals restart from now (no stacking)
            start = uint64(block.timestamp);
        }
        uint64 newExpiry = start + tiers[creator][tierId].duration;
        subscriptionExpiry[payer][creator] = newExpiry;

        // enumerate subscribers (append-once)
        if (!_isKnownSubscriber[creator][payer]) {
            _isKnownSubscriber[creator][payer] = true;
            _creatorSubscribers[creator].push(payer);
            if (!_isKnownCreatorForUser[payer][creator]) {
                _isKnownCreatorForUser[payer][creator] = true;
                _userCreators[payer].push(creator);
            }
        }

        if (accessPass != address(0)) {
            IAccessPass(accessPass).mintIfNone(payer, creator);
            // Try tier-aware update; fallback to legacy updateOnRenew if unavailable
            (bool ok, ) = accessPass.call(
                abi.encodeWithSelector(
                    SELECTOR_UPDATE_ON_RENEW_WITH_TIER,
                    payer,
                    creator,
                    newExpiry,
                    tierId
                )
            );
            if (!ok) {
                IAccessPass(accessPass).updateOnRenew(payer, creator, newExpiry);
            }
        }

        emit Subscribed(payer, creator, tierId, newExpiry, amount, token);
    }

    // Subscribe with ERC20 permit (EIP-2612)
    function subscribeWithPermit(
        address creator,
        uint256 tierId,
        uint256 permitValue,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        Tier memory t = _loadActiveTier(creator, tierId);
        address token = t.paymentToken;
        if (token == address(0)) revert NotErc20Tier();

        uint256 amount = _resolveAmount(creator, tierId, t);

        if (permitValue < amount) revert PermitTooLow();
        IERC20Permit(token).permit(msg.sender, address(this), permitValue, deadline, v, r, s);

        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert ERC20TransferFailed();

        _processSubscription(msg.sender, creator, tierId, amount, token);
    }

    // Raw withdrawal hooks (callable only by Treasury extension)
    function withdrawCreatorToRaw(address caller, address token, address dst) external onlyTreasury nonReentrant {
        if (dst == address(0)) revert ZeroAddress();
        if (!registry.isCreator(caller)) revert NotCreator();
        _withdrawCreatorToFor(caller, token, dst);
    }
    
    function _withdrawCreatorToFor(address creator, address token, address dst) internal {
        uint256 amt = creatorBalanceByToken[creator][token];
        if (amt == 0) revert AmountZero();
        creatorBalanceByToken[creator][token] = 0;
        if (token == address(0)) {
            (bool ok, ) = dst.call{value: amt}("");
            if (!ok) revert EthTransferFailed();
        } else {
            bool ok = IERC20(token).transfer(dst, amt);
            if (!ok) revert ERC20TransferFailed();
        }
        emit CreatorWithdrawn(creator, token, amt);
    }

    // Withdraw to registry-configured payout address
    function withdrawCreatorToPayoutRaw(address caller, address token) external onlyTreasury nonReentrant {
        address payout = ICreatorRegistry(address(registry)).getPayoutAddress(caller);
        if (payout == address(0)) revert ZeroAddress();
        if (!registry.isCreator(caller)) revert NotCreator();
        _withdrawCreatorToFor(caller, token, payout);
    }
    

    function withdrawPlatformRaw(address caller, address token) external onlyTreasury nonReentrant {
        if (!(caller == platformTreasury || caller == owner())) revert NotTreasuryOrOwner();
        uint256 amt = platformBalanceByToken[token];
        if (amt == 0) revert AmountZero();
        platformBalanceByToken[token] = 0;
        if (token == address(0)) {
            (bool ok, ) = platformTreasury.call{value: amt}("");
            if (!ok) revert EthTransferFailed();
        } else {
            bool ok = IERC20(token).transfer(platformTreasury, amt);
            if (!ok) revert ERC20TransferFailed();
        }
        emit PlatformWithdrawn(platformTreasury, token, amt);
    }

    // Creator config setters
    function setCreatorGracePeriod(uint64 secondsGrace) external onlyCreator {
        creatorGracePeriod[msg.sender] = secondsGrace;
        emit CreatorGracePeriodUpdated(msg.sender, secondsGrace);
    }
    

    function setCreatorFeeCapBps(uint96 bps) external onlyCreator {
        if (bps > platformFeeBps) revert FeeTooHigh();
        creatorFeeCapBps[msg.sender] = bps;
        emit CreatorFeeCapUpdated(msg.sender, bps);
    }
    

    
}
