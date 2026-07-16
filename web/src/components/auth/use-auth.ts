"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { createSiweMessage } from "viem/siwe";
import { getAddress } from "viem";
import { MONAD_MAINNET_CHAIN_ID } from "@/config/chains";
import { SIWE_STATEMENT } from "@/lib/auth/constants";
import { fetchSession, fetchNonce, verifySignature, logout as logoutApi } from "@/lib/auth/api";

const SESSION_KEY = ["auth", "session"] as const;

/**
 * The app's single source of auth truth. Combines the wallet-connection state
 * (wagmi) with the server-verified SIWE session (react-query over /api/auth).
 * "Authenticated" means a valid session cookie exists — not merely that a
 * wallet is connected.
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const { address: connectedAddress, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const sessionQuery = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: 30_000,
  });

  const signIn = useMutation({
    mutationFn: async () => {
      // 1. Ensure a wallet is connected. Prefer the config's registered
      // injected connector; fall back to a fresh instance if absent.
      let account = connectedAddress;
      if (!isConnected || !account) {
        const connector = connectors.find((c) => c.type === "injected") ?? injected();
        const result = await connectAsync({ connector });
        account = result.accounts[0];
      }
      if (!account) throw new Error("No wallet account available.");

      // 2. Enforce Monad Mainnet before signing.
      if (chainId !== MONAD_MAINNET_CHAIN_ID) {
        await switchChainAsync({ chainId: MONAD_MAINNET_CHAIN_ID });
      }

      // 3. Nonce → SIWE message → signature.
      const nonce = await fetchNonce();
      const message = createSiweMessage({
        domain: window.location.host,
        address: getAddress(account),
        statement: SIWE_STATEMENT,
        uri: window.location.origin,
        version: "1",
        chainId: MONAD_MAINNET_CHAIN_ID,
        nonce,
        issuedAt: new Date(),
      });
      const signature = await signMessageAsync({ message });

      // 4. Server verification issues the session cookie.
      return verifySignature(message, signature);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });

  const signOut = useMutation({
    mutationFn: async () => {
      await logoutApi();
      await disconnectAsync().catch(() => {
        // Wallet already disconnected — server session is what matters.
      });
    },
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, { address: null }),
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
    [queryClient],
  );

  return {
    /** Authenticated wallet address, or null when not signed in. */
    address: sessionQuery.data?.address ?? null,
    isAuthenticated: Boolean(sessionQuery.data?.address),
    isSessionLoading: sessionQuery.isLoading,
    /** Wallet-level connection (may be connected but not yet SIWE-signed). */
    isWalletConnected: isConnected,
    connectedAddress,
    isOnMonadMainnet: chainId === MONAD_MAINNET_CHAIN_ID,
    signIn: signIn.mutateAsync,
    isSigningIn: signIn.isPending,
    signInError: signIn.error,
    signOut: signOut.mutateAsync,
    isSigningOut: signOut.isPending,
    refresh,
  };
}
