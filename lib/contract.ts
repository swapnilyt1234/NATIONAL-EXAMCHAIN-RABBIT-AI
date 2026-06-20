import type { Address } from "viem";

export const contractAddress =
  (process.env.NEXT_PUBLIC_EDU_CONTRACT_ADDRESS as Address | undefined) ??
  "0x0000000000000000000000000000000000000000";

export const abi = [
  {
    type: "function",
    name: "uploadContent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ipfsHash", type: "string" },
      { name: "releaseTime", type: "uint256" },
    ],
    outputs: [{ name: "contentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "approveContent",
    stateMutability: "nonpayable",
    inputs: [{ name: "contentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeContent",
    stateMutability: "nonpayable",
    inputs: [{ name: "contentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "mintAccessNFT",
    stateMutability: "nonpayable",
    inputs: [
      { name: "student", type: "address" },
      { name: "contentId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getContent",
    stateMutability: "view",
    inputs: [{ name: "contentId", type: "uint256" }],
    outputs: [
      { name: "ipfsHash", type: "string" },
      { name: "releaseTime", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getAllContentIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getPendingContent",
    stateMutability: "view",
    inputs: [{ name: "contentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "ipfsHash", type: "string" },
          { name: "approvals", type: "uint256" },
          { name: "releaseTime", type: "uint256" },
          { name: "released", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "hasContentAccess",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "ADMIN_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "EXAM_CENTER_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "ContentUploaded",
    inputs: [
      { name: "contentId", type: "uint256", indexed: true },
      { name: "uploadedBy", type: "address", indexed: true },
      { name: "ipfsHash", type: "string", indexed: false },
      { name: "releaseTime", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ContentReleased",
    inputs: [
      { name: "contentId", type: "uint256", indexed: true },
      { name: "releaseTime", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AccessGranted",
    inputs: [
      { name: "contentId", type: "uint256", indexed: true },
      { name: "student", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
    anonymous: false,
  },
] as const;
