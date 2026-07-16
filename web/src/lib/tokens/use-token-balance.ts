"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { NATIVE_SENTINEL, type TokenRef } from "./types";

/**
 * Creator's balance of a token, in base units. Handles native MON (which has
 * no contract to call `balanceOf` on) and ERC-20s through one interface.
 *
 * Balance is shown for native MON even though it isn't distributable — users
 * hold MON for gas and expect to see it.
 */
export function useTokenBalance(ref: TokenRef | undefined): {
  balance?: bigint;
  isLoading: boolean;
} {
  const { address: account } = useAccount();
  const isNative = ref === NATIVE_SENTINEL;
  const tokenAddress = !isNative && ref ? (ref as `0x${string}`) : undefined;

  const native = useBalance({
    address: account,
    query: { enabled: Boolean(account) && isNative },
  });

  const erc20 = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(account && tokenAddress) },
  });

  if (isNative) {
    return { balance: native.data?.value, isLoading: native.isLoading };
  }
  return { balance: erc20.data as bigint | undefined, isLoading: erc20.isLoading };
}
