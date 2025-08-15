export const SubscriptionManagerAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'tiersLength',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Dev/admin: creator-controlled tier creation (used by seeding endpoints)
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'createTier',
    inputs: [
      { name: 'price', type: 'uint256' },
      { name: 'duration', type: 'uint64' },
      { name: 'metadataURI', type: 'string' },
      { name: 'paymentToken', type: 'address' },
    ],
    outputs: [{ name: 'tierId', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'createTierOracle',
    inputs: [
      { name: 'usdPrice', type: 'uint256' },
      { name: 'duration', type: 'uint64' },
      { name: 'metadataURI', type: 'string' },
      { name: 'paymentToken', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'tokenDecimals', type: 'uint8' },
    ],
    outputs: [{ name: 'tierId', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'tiers',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [
      {
        components: [
          { name: 'price', type: 'uint256' },
          { name: 'duration', type: 'uint64' },
          { name: 'metadataURI', type: 'string' },
          { name: 'active', type: 'bool' },
          { name: 'paymentToken', type: 'address' },
          { name: 'deleted', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'tierUsesOracle',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'tierId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'subscriptionExpiry',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'creator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    stateMutability: 'payable',
    name: 'subscribe',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'tierId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'subscribeWithPermit',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'tierId', type: 'uint256' },
      { name: 'permitValue', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'platformFeeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint96' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'accessPass',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // Management and helpers
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setTierActive',
    inputs: [
      { name: 'tierId', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'deleteTier',
    inputs: [
      { name: 'tierId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'updateTier',
    inputs: [
      { name: 'tierId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'duration', type: 'uint64' },
      { name: 'metadataURI', type: 'string' },
      { name: 'paymentToken', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'allowedTokens',
    inputs: [
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'tierId', type: 'uint256', indexed: true },
      { name: 'expiresAt', type: 'uint64', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'paymentToken', type: 'address', indexed: false },
    ],
    anonymous: false,
  },
] as const;
