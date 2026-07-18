// GENERATED — do not edit by hand.
// Source: contracts/out/Distribution.sol/Distribution.json (forge build output).
// Regenerate after any contract change; a hand-written ABI that drifts from
// the deployed contract silently misencodes calls that move real money.

export const distributionAbi = [
  {
    type: "function",
    name: "RECLAIM_GRACE_PERIOD",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancel",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "chunkCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "chunkExecuted",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "chunkHashes",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "commitChunk",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "payload",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "committedCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "executeAfter",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "executeChunk",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "payload",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executedCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "failed",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "position",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "failedAmount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeBps",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint16",
        internalType: "uint16",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "fund",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      {
        name: "creator_",
        type: "address",
        internalType: "address",
      },
      {
        name: "token_",
        type: "address",
        internalType: "address",
      },
      {
        name: "executeAfter_",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "chunkCount_",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "feeBps_",
        type: "uint16",
        internalType: "uint16",
      },
      {
        name: "treasury_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reclaim",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reclaimed",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "retry",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "payload",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "positions",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "schedule",
    inputs: [
      {
        name: "executeAfter_",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "enum Distribution.State",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAmount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalPaid",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "treasury",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      {
        name: "refunded",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ChunkExecuted",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "executor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DistributionScheduled",
    inputs: [
      {
        name: "executeAfter",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      {
        name: "funder",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "fee",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Paid",
    inputs: [
      {
        name: "recipient",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "chunkIndex",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "position",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PaymentFailed",
    inputs: [
      {
        name: "recipient",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "chunkIndex",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "position",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RecipientsCommitted",
    inputs: [
      {
        name: "chunkIndex",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "payload",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Reclaimed",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyInitialized",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyReclaimed",
    inputs: [],
  },
  {
    type: "error",
    name: "ChunkAlreadyCommitted",
    inputs: [],
  },
  {
    type: "error",
    name: "ChunkAlreadyExecuted",
    inputs: [],
  },
  {
    type: "error",
    name: "ChunkNotExecuted",
    inputs: [],
  },
  {
    type: "error",
    name: "ChunkOutOfRange",
    inputs: [],
  },
  {
    type: "error",
    name: "EmptyPayload",
    inputs: [],
  },
  {
    type: "error",
    name: "IncorrectValue",
    inputs: [],
  },
  {
    type: "error",
    name: "InsufficientGas",
    inputs: [
      {
        name: "position",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidPayloadLength",
    inputs: [],
  },
  {
    type: "error",
    name: "NativeTransferFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "NotCreator",
    inputs: [],
  },
  {
    type: "error",
    name: "NotFailed",
    inputs: [
      {
        name: "position",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "NothingToReclaim",
    inputs: [],
  },
  {
    type: "error",
    name: "PayloadMismatch",
    inputs: [],
  },
  {
    type: "error",
    name: "ReentrancyGuardReentrantCall",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "TooEarly",
    inputs: [],
  },
  {
    type: "error",
    name: "UnsupportedToken",
    inputs: [],
  },
  {
    type: "error",
    name: "WrongState",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAmount",
    inputs: [
      {
        name: "position",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "ZeroRecipient",
    inputs: [
      {
        name: "position",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
] as const;
