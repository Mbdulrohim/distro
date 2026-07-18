// GENERATED — do not edit by hand.
// Source: contracts/out/MultisendNative.sol/MultisendNative.json (forge build output).
// Regenerate after any contract change; a hand-written ABI that drifts from
// the deployed contract silently misencodes calls that move real money.

export const multisendNativeAbi = [
  {
    type: "function",
    name: "distribute",
    inputs: [
      {
        name: "payload",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [
      {
        name: "totalPaid",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "paidCount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "failedCount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "payable",
  },
  {
    type: "event",
    name: "Distributed",
    inputs: [
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "totalPaid",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "paidCount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "failedCount",
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
        name: "index",
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
        name: "index",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
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
        name: "index",
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
    name: "ReentrancyGuardReentrantCall",
    inputs: [],
  },
  {
    type: "error",
    name: "RefundFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroRecipient",
    inputs: [
      {
        name: "index",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
] as const;
