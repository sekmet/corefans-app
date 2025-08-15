# Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

[Foundry Book](https://book.getfoundry.sh/)

## Usage

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Format

```shell
forge fmt
```

### Gas Snapshots

```shell
forge snapshot
```

### Anvil

```shell
anvil
```

### Deploy

```shell
forge script script/Counter.s.sol:CounterScript --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### Cast

```shell
cast <subcommand>
```

### Help

```shell
forge --help
anvil --help
cast --help
```

## Example usage

### Deploy (with resolver and sample tiers)

Set env: PRIVATE_KEY, PLATFORM_TREASURY, PLATFORM_FEE_BPS, BASE_URI, ACCESS_PASS_RESOLVER, CREATOR_PAYOUT, etc.
Run: `forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast`

### Update a tier to use default oracle

`PRIVATE_KEY=... SUBSCRIPTION_MANAGER=... CREATOR=... TIER_ID=0 USD_PRICE=100000000000 forge script script/UpdateTierOracle.s.sol --rpc-url $RPC_URL --broadcast`

### Withdraw creator to payout (ETH)

`PRIVATE_KEY=... SUBSCRIPTION_MANAGER=... TOKEN=0x0000000000000000000000000000000000000000 forge script script/WithdrawCreator.s.sol --rpc-url $RPC_URL --broadcast`

### Env-driven setup

PLATFORM_TREASURY, PLATFORM_FEE_BPS, BASE_URI
ACCESS_PASS_RESOLVER or reuse an existing ACCESS_PASS_ADDRESS
CREATOR_PAYOUT (optional registry registration for owner as creator)
ALLOW_TOKEN allowlist
DEFAULT_TOKEN, DEFAULT_ORACLE, DEFAULT_TOKEN_DECIMALS for default oracle mapping

### Existing deployments and freshDeploy logic (Deploy.s.sol)

Deploy.s.sol supports attaching to existing core contracts via environment variables:

- REGISTRY_ADDRESS: existing `CreatorRegistry` address
- SUBSCRIPTION_MANAGER_ADDRESS: existing `SubscriptionManager` address

Behavior:

- freshDeploy = (REGISTRY_ADDRESS == 0 || SUBSCRIPTION_MANAGER_ADDRESS == 0)
  - If either address is not provided (zero), the script deploys fresh instances for missing components and performs owner-only wiring.
  - If both are provided (non-zero), the script treats this as an existing deployment and will NOT perform owner-only wiring.

Owner-only wiring performed only when freshDeploy is true:

- Set or wire `AccessPass` and call `subs.setAccessPass(...)`.
- Optional registry registration for the owner as a creator, if `CREATOR_PAYOUT` is set.
- Allowlist a token if `ALLOW_TOKEN` is set.
- Set a default oracle mapping if `DEFAULT_ORACLE` and `DEFAULT_TOKEN_DECIMALS` are set.
- Optionally create sample tiers if the corresponding SAMPLE_* env vars are provided and the owner is registered as creator.

This separation avoids permission/ownership issues when pointing the script at existing production deployments.

### Sample tier creation

Fixed: SAMPLE_FIXED_PRICE_WEI, SAMPLE_FIXED_DURATION, SAMPLE_TIER_METADATA
Oracle: SAMPLE_ORACLE_USD_PRICE, SAMPLE_ORACLE_DURATION, SAMPLE_ORACLE_PAYMENT_TOKEN, SAMPLE_ORACLE_AGGREGATOR, SAMPLE_ORACLE_TOKEN_DECIMALS

### Oracle pricing and staleness

- Amount calculation for oracle-priced tiers:

  ```text
  amount = (usdPrice[1e8] * 10^tokenDecimals) / answer[1e8]
  ```

- Staleness window: `ORACLE_STALE_AFTER = 2 hours`.
  - A feed is considered stale if `block.timestamp - updatedAt > ORACLE_STALE_AFTER`.
  - The contract also reverts if `answer <= 0` or if the feed is future-dated (`updatedAt > block.timestamp`).

### Slippage-protected subscriptions (oracle tiers)

- For oracle-priced tiers, users can protect against price movement between quote and execution time.
- Functions:
  - `subscribeWithMax(address creator, uint256 tierId, uint256 maxAmount)` for ERC20 tiers (requires prior approve).
  - `subscribeEthWithMax(address creator, uint256 tierId, uint256 maxAmount)` for ETH tiers.
- Both paths compute the current amount from the oracle and revert with `"slippage"` if `amount > maxAmount`.

### Renewal modes and semantics

Subscription renewals can follow one of two creator-configurable modes:

- **Extend (default)**
  - Early renewals extend from the later of current expiry or now: `newExpiry = max(currentExpiry, now) + duration`.
  - If the subscription has lapsed (expiry < now), a renewal starts from now: `newExpiry = now + duration`.

- **Reset**
  - Early renewals always reset from now, ignoring any remaining time: `newExpiry = now + duration`.
  - If lapsed, behavior is the same as Extend: `newExpiry = now + duration`.

Notes:

- **Grace period** affects access checks only (e.g., `hasActiveSubscription(user, creator)`) and does not change expiry math in either mode.
- Mode is set per-creator and can be changed at any time; changes take effect for subsequent renewals only.
- Default mode is **Extend** for backward compatibility.

API:

- Enum: `RenewalMode { Extend, Reset }`.
- Setter (creator only, when not paused): `setCreatorRenewalMode(RenewalMode mode)`.
- Mapping: `creatorRenewalMode[creator] -> RenewalMode`.
- Event: `CreatorRenewalModeUpdated(address indexed creator, RenewalMode mode)`.

### Non-standard ERC20s

- The manager calls `IERC20.transferFrom` and expects a standard boolean return value.
- Non-standard tokens that do not return a boolean may revert due to ABI decoding when called via the standard interface.
- Use standard-compliant ERC20s (or wrap non-standard tokens) for compatibility.