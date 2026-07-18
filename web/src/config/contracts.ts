import { MONAD_MAINNET_CHAIN_ID } from "./chains";

/**
 * Deployed contract addresses, per chain.
 *
 * Kept in sync with `contracts/deployments/*.json` — if these drift, the app
 * talks to the wrong contract. Update both, in the same commit, always.
 *
 * `undefined` means "not deployed yet" and is handled explicitly rather than
 * papered over with a zero address: a zero address would sail through
 * type-checking and fail at transaction time, in front of a user who is trying
 * to move money. `getMultisendAddress` throws instead.
 */

const MONAD_TESTNET_CHAIN_ID = 10143;

interface ChainContracts {
  multisend?: `0x${string}`;
  /** Native-MON sibling of `multisend` — same non-custodial guarantee, for
   * the currency `multisend` (ERC-20 `transferFrom`-based) cannot move. See
   * contracts/src/MultisendNative.sol. */
  multisendNative?: `0x${string}`;
  /** `DistributionFactory` — the Tier-2 scheduled-escrow system. Undeployed
   * everywhere today; see contracts/src/DistributionFactory.sol. */
  distributionFactory?: `0x${string}`;
}

const CONTRACTS: Record<number, ChainContracts> = {
  [MONAD_MAINNET_CHAIN_ID]: {
    // WIRED IN (2026-07-19): 0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538 (block
    // 88344367). Still UNAUDITED — this is a deliberate exception to the
    // "audited before mainnet" rule, not a reversal of it, made explicitly by
    // the user after the risk was restated: Multisend is stateless and
    // non-custodial by construction (tokens move sender -> recipient in one
    // call, the contract's balance is always zero), so a bug here cannot
    // strand or steal escrowed funds the way one could in `Distribution`
    // (the scheduled/escrow contract, which stays undefined below and
    // remains blocked on a real audit — see docs/AUDIT_SCOPE.md). Worst case
    // for Multisend is a failed/misencoded send, and the tokens never leave
    // the sender's wallet. See contracts/deployments/monad-mainnet.json —
    // bytecodeVerified there is true from the original deployment session;
    // it could not be independently re-verified from this environment (no
    // network access here) before this change, so re-verify with
    // `cast code 0xd9C7…4538 --rpc-url https://rpc.monad.xyz` when you can.
    multisend: "0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538",
    // WIRED IN (2026-07-19), deployed the same day at the user's explicit
    // instruction: 0x856Cd381Fbc2d6f880a509F372F2c806d89415b4 (block
    // 88632513). Same non-custodial risk category as Multisend above — no
    // owner, no admin, no privileged role, and any undelivered MON is
    // refunded to the caller within the same transaction (see
    // src/MultisendNative.sol and its 12-test suite: the "never retains
    // balance" invariant is directly tested). UNAUDITED, same as Multisend.
    // Bytecode verified live via `cast code` immediately after deployment —
    // see contracts/deployments/monad-mainnet.json.
    multisendNative: "0x856Cd381Fbc2d6f880a509F372F2c806d89415b4",
    // Not deployed anywhere yet. Unlike Multisend, this contract holds real
    // user funds in escrow between fund() and execution — deploying it is a
    // strictly higher-stakes action, gated on its own explicit go-ahead, on
    // top of the audit bar above. See contracts/src/DistributionFactory.sol
    // and docs/AUDIT_SCOPE.md.
    distributionFactory: undefined,
  },
  [MONAD_TESTNET_CHAIN_ID]: {
    // Verified byte-for-byte against out/Multisend.sol/Multisend.json.
    // contracts/deployments/monad-testnet.json — keep both in sync.
    multisend: "0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538",
    // Not deployed on testnet — only mainnet, per the user's explicit
    // deployment choice. Native MON is therefore not distributable via the
    // immediate path on testnet today.
    multisendNative: undefined,
    distributionFactory: undefined,
  },
};

/** True when the app can actually execute a distribution on this chain. */
export function isMultisendDeployed(chainId: number): boolean {
  return Boolean(CONTRACTS[chainId]?.multisend);
}

/**
 * Deployed `Multisend` address for a chain.
 * @throws if not deployed — callers must gate on `isMultisendDeployed` and show
 * a real state, never attempt a transaction against a missing contract.
 */
export function getMultisendAddress(chainId: number): `0x${string}` {
  const address = CONTRACTS[chainId]?.multisend;
  if (!address) {
    throw new Error(
      `Multisend is not deployed on chain ${chainId}. See contracts/deployments/ and docs/ROADMAP.md.`,
    );
  }
  return address;
}

/** True when the app can distribute native MON directly on this chain. */
export function isMultisendNativeDeployed(chainId: number): boolean {
  return Boolean(CONTRACTS[chainId]?.multisendNative);
}

/**
 * Deployed `MultisendNative` address for a chain.
 * @throws if not deployed — callers must gate on `isMultisendNativeDeployed`
 * and show a real state, never attempt a transaction against a missing contract.
 */
export function getMultisendNativeAddress(chainId: number): `0x${string}` {
  const address = CONTRACTS[chainId]?.multisendNative;
  if (!address) {
    throw new Error(`MultisendNative is not deployed on chain ${chainId}.`);
  }
  return address;
}

/** True when scheduled/escrow distributions are available on this chain. */
export function isDistributionFactoryDeployed(chainId: number): boolean {
  return Boolean(CONTRACTS[chainId]?.distributionFactory);
}

/**
 * Deployed `DistributionFactory` address for a chain.
 * @throws if not deployed — callers must gate on `isDistributionFactoryDeployed`
 * and show a real state, never attempt a transaction against a missing contract.
 */
export function getDistributionFactoryAddress(chainId: number): `0x${string}` {
  const address = CONTRACTS[chainId]?.distributionFactory;
  if (!address) {
    throw new Error(`DistributionFactory is not deployed on chain ${chainId}.`);
  }
  return address;
}
