// This is the standard ABI for the ERC-20 'transfer' function.
// We only need this small part of the full ABI to send tokens.
export const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const; // 'as const' makes this a read-only type for better TypeScript safety