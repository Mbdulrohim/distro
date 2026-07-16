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
}

const CONTRACTS: Record<number, ChainContracts> = {
  [MONAD_MAINNET_CHAIN_ID]: {
    // Not deployed. Blocked on: measured MIN_GAS_PER_TRANSFER (F3) and an
    // external audit — see docs/ROADMAP.md. Do not fill this in to "unblock"
    // the UI; an unaudited mainnet address is how people lose payroll.
    multisend: undefined,
  },
  [MONAD_TESTNET_CHAIN_ID]: {
    // Populate from `forge script script/DeployMultisend.s.sol` output.
    multisend: undefined,
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
