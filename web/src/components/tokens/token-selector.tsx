"use client";

import { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { AlertTriangle, Check, Loader2, Ban } from "lucide-react";
import { getSupportedTokens } from "@/lib/tokens/registry";
import { useTokenInfo } from "@/lib/tokens/use-token-info";
import { useTokenBalance } from "@/lib/tokens/use-token-balance";
import { formatAmountWithSymbol } from "@/lib/recipients/format";
import { truncateAddress } from "@/lib/format";
import { NATIVE_SENTINEL, type TokenRef, type TokenSelection } from "@/lib/tokens/types";
import type { RegistryToken } from "@/lib/tokens/types";
import { cn } from "@/lib/utils";

/**
 * Choose the distribution token: a supported-token list with live balances,
 * plus any ERC-20 by address.
 *
 * Integrates with the distribution engine by emitting the resolved token —
 * its `decimals` drive human↔base conversion in the recipient pipeline and its
 * `balance` drives the sufficient-balance check.
 *
 * Native MON appears with its balance. Whether it's selectable depends on
 * `mode`: `Multisend` ("immediate") has no native path — MON points at WMON
 * instead — while the escrow contract ("scheduled") takes native MON directly.
 */

interface TokenSelectorProps {
  /** Total the distribution needs, base units — enables the balance check. */
  requiredAmount?: bigint;
  onSelect?: (token: TokenSelection | undefined) => void;
  /** Pre-selects a token ref (e.g. when starting a distribution from a
   * saved template). Only applied once, on mount — not a controlled value. */
  initialRef?: TokenRef;
  /** Which contract this selection is for — decides whether native MON is
   * distributable. Defaults to "immediate" (`Multisend`), today's only wired path. */
  mode?: "immediate" | "scheduled";
}

export function TokenSelector({
  requiredAmount,
  onSelect,
  initialRef,
  mode = "immediate",
}: TokenSelectorProps) {
  const chainId = useChainId();
  const supported = getSupportedTokens(chainId);

  const [selectedRef, setSelectedRef] = useState<TokenRef | undefined>(initialRef);
  const [customInput, setCustomInput] = useState(() =>
    initialRef && !supported.some((t) => t.ref === initialRef) ? initialRef : "",
  );

  const { token, isLoading, error } = useTokenInfo(selectedRef, mode);
  const { balance, isLoading: balanceLoading } = useTokenBalance(selectedRef);

  const insufficient =
    token?.distributable && requiredAmount !== undefined && balance !== undefined
      ? balance < requiredAmount
      : false;

  useEffect(() => {
    if (token?.distributable && !insufficient) {
      onSelect?.({ ...token, balance });
    } else {
      onSelect?.(undefined);
    }
  }, [token, balance, insufficient, onSelect]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {supported.map((t) => (
          <TokenRow
            key={t.ref}
            token={t}
            mode={mode}
            selected={selectedRef === t.ref}
            onSelect={() => {
              setSelectedRef(t.ref);
              setCustomInput("");
            }}
          />
        ))}
      </div>

      {/* Custom token */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="custom-token" className="text-xs text-muted-foreground">
          Or paste any ERC-20 address
        </label>
        <input
          id="custom-token"
          value={customInput}
          onChange={(e) => {
            const v = e.target.value.trim();
            setCustomInput(v);
            setSelectedRef(v === "" ? undefined : (v as TokenRef));
          }}
          placeholder="0x…"
          className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {/* Resolution state */}
      {selectedRef ? (
        <div className="rounded-lg border border-border px-4 py-3 text-sm">
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Reading token…
            </span>
          ) : error ? (
            <span className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </span>
          ) : token ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {token.distributable ? (
                    <Check className="size-4 text-muted-foreground" />
                  ) : (
                    <Ban className="size-4 text-destructive" />
                  )}
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-muted-foreground">· {token.decimals} decimals</span>
                </span>
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  {balanceLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : balance !== undefined ? (
                    <>Balance: {formatAmountWithSymbol(balance, token.decimals, token.symbol)}</>
                  ) : null}
                </span>
              </div>

              {!token.distributable && token.unsupportedReason ? (
                <p className="text-destructive">{token.unsupportedReason}</p>
              ) : null}

              {insufficient && requiredAmount !== undefined && balance !== undefined ? (
                <p className="text-destructive">
                  Insufficient balance — this distribution needs{" "}
                  {formatAmountWithSymbol(requiredAmount, token.decimals, token.symbol)}, short by{" "}
                  {formatAmountWithSymbol(requiredAmount - balance, token.decimals, token.symbol)}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TokenRow({
  token,
  selected,
  onSelect,
  mode,
}: {
  token: RegistryToken;
  selected: boolean;
  onSelect: () => void;
  mode: "immediate" | "scheduled";
}) {
  const { balance } = useTokenBalance(token.ref);
  const { token: info } = useTokenInfo(token.ref, mode);
  // The registry's `distributable` reflects Multisend eligibility (its own
  // doc comment says so); the live, mode-aware value from `useTokenInfo` is
  // what native MON's eligibility actually depends on.
  const distributable = info?.distributable ?? token.distributable;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-left text-sm transition-colors",
        selected ? "border-ring bg-muted" : "border-border hover:bg-muted/50",
        !distributable && "opacity-60",
      )}
    >
      <span className="flex flex-col">
        <span className="flex items-center gap-2 font-medium">
          {token.symbol}
          {!distributable ? (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[0.7rem] font-normal text-muted-foreground">
              not distributable
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {token.name}
          {token.ref !== NATIVE_SENTINEL ? ` · ${truncateAddress(token.ref)}` : ""}
        </span>
      </span>
      {balance !== undefined && info ? (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {formatAmountWithSymbol(balance, info.decimals, info.symbol)}
        </span>
      ) : null}
    </button>
  );
}
