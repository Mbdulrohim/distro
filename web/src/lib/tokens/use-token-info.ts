"use client";

import { useMemo } from "react";
import { useChainId, useReadContracts } from "wagmi";
import { erc20Abi, isAddress } from "viem";
import { monadMainnet } from "@/config/chains";
import { findRegistryToken } from "./registry";
import { NATIVE_SENTINEL, type ResolvedToken, type TokenRef } from "./types";

/**
 * Resolve a token against the chain. `decimals` is ALWAYS read on-chain and
 * never taken from the registry — a wrong decimals value is a 10^n money bug.
 *
 * For registry tokens the on-chain `symbol()` is cross-checked against the
 * expected symbol. A mismatch means the registry address is wrong (typo, bad
 * source, or a look-alike contract) and the token is refused rather than used.
 * That check is what makes an address we could not verify at authoring time
 * fail loudly instead of quietly moving money to the wrong contract.
 */
export interface UseTokenInfoResult {
  token?: ResolvedToken;
  isLoading: boolean;
  /** Human-readable, already user-facing. */
  error?: string;
}

/**
 * `mode` decides whether native MON can resolve as distributable. `Multisend`
 * ("immediate") has no native path — MON only resolves for the escrow
 * ("scheduled") path, where `fund()` takes native value directly. ERC-20s are
 * distributable either way, so `mode` only changes the native branch.
 */
export function useTokenInfo(
  ref: TokenRef | undefined,
  mode: "immediate" | "scheduled" = "immediate",
): UseTokenInfoResult {
  const chainId = useChainId();
  const isNative = ref === NATIVE_SENTINEL;
  const address = !isNative && ref && isAddress(ref) ? (ref as `0x${string}`) : undefined;

  const { data, isLoading, isError } = useReadContracts({
    contracts: address
      ? [
          { address, abi: erc20Abi, functionName: "symbol" },
          { address, abi: erc20Abi, functionName: "decimals" },
        ]
      : [],
    query: { enabled: Boolean(address) },
  });

  return useMemo<UseTokenInfoResult>(() => {
    if (!ref) return { isLoading: false };

    // Native MON: metadata comes from the chain definition, not a contract.
    if (isNative) {
      const entry = findRegistryToken(chainId, NATIVE_SENTINEL);
      const distributable = mode === "scheduled";
      return {
        isLoading: false,
        token: {
          ref: NATIVE_SENTINEL,
          symbol: monadMainnet.nativeCurrency.symbol,
          decimals: monadMainnet.nativeCurrency.decimals,
          isNative: true,
          distributable,
          unsupportedReason: distributable ? undefined : entry?.unsupportedReason,
        },
      };
    }

    if (!address) return { isLoading: false, error: "That doesn't look like a valid address." };
    if (isLoading) return { isLoading: true };

    const symbolResult = data?.[0];
    const decimalsResult = data?.[1];

    // Reads failing is the signal for "no ERC-20 here" — an EOA or a contract
    // that isn't a token. Never let this look like a resolved token.
    if (isError || symbolResult?.status !== "success" || decimalsResult?.status !== "success") {
      return { isLoading: false, error: "Not an ERC-20 token on Monad Mainnet." };
    }

    const symbol = symbolResult.result as string;
    const decimals = Number(decimalsResult.result);

    const registryEntry = findRegistryToken(chainId, address);
    if (registryEntry && registryEntry.symbol.toLowerCase() !== symbol.toLowerCase()) {
      return {
        isLoading: false,
        error:
          `Token mismatch: expected ${registryEntry.symbol} at this address but found ${symbol}. ` +
          `Refusing to use it — report this, the token list may be wrong.`,
      };
    }

    return {
      isLoading: false,
      token: {
        ref: address,
        address,
        symbol,
        decimals,
        isNative: false,
        distributable: true,
      },
    };
  }, [ref, isNative, address, chainId, data, isLoading, isError, mode]);
}
