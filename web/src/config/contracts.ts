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
  /** `DistributionFactory` — the Tier-2 scheduled-escrow system. Undeployed
   * everywhere today; see contracts/src/DistributionFactory.sol. */
  distributionFactory?: `0x${string}`;
}

const CONTRACTS: Record<number, ChainContracts> = {
  [MONAD_MAINNET_CHAIN_ID]: {
    // DEPLOYED but deliberately NOT wired in:
    //   0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538 (block 88344367)
    //
    // The contract is UNAUDITED. Deploying it endangered nobody — it is
    // ownerless, stateless, and holds nothing. Risk begins the moment real
    // tokens are approved to it, which is exactly what filling this in would
    // enable. docs/CTO_REVIEW.md makes an external audit blocking for
    // mainnet, and the PRD's bar is "zero funds lost".
    //
    // Do not populate this to "unblock" the UI. Prove execution on testnet,
    // get the audit, then wire it. See contracts/deployments/monad-mainnet.json.
    multisend: undefined,
    // Not deployed anywhere yet. Unlike Multisend, this contract holds real
    // user funds in escrow between fund() and execution — deploying it is a
    // strictly higher-stakes action, gated on its own explicit go-ahead, on
    // top of the audit bar above. See contracts/src/DistributionFactory.sol.
    distributionFactory: undefined,
  },
  [MONAD_TESTNET_CHAIN_ID]: {
    // Verified byte-for-byte against out/Multisend.sol/Multisend.json.
    // contracts/deployments/monad-testnet.json — keep both in sync.
    multisend: "0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538",
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
