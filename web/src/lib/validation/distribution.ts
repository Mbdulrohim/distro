import { z } from "zod";
import { isAddress } from "viem";

/**
 * Server-authoritative validation for creating a distribution.
 *
 * The client validates the same things for fast feedback, but client
 * validation is UX, never a security boundary — anything here could be posted
 * directly by a script. In particular the server **recomputes the total** from
 * the recipient rows rather than trusting the client's figure: a mismatched
 * total is how a distribution ends up under-funded and silently shorts whoever
 * sorts last.
 */

const UINT128_MAX = 340282366920938463463374607431768211455n;

/** A 0x-prefixed, checksum-valid EVM address. */
const addressSchema = z
  .string()
  .refine((v) => isAddress(v), { message: "Not a valid EVM address" });

/**
 * Base-units amount as a decimal string. String, not number: 18-decimal base
 * units exceed 2^53 at ~0.01 tokens, so JSON numbers would silently round.
 */
const amountSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a whole number of base units")
  .refine((v) => {
    const n = BigInt(v);
    return n >= 1n && n <= UINT128_MAX;
  }, `Amount must be between 1 and ${UINT128_MAX} (the payload's uint128 cap)`);

export const recipientInputSchema = z.object({
  address: addressSchema,
  amount: amountSchema,
});

export const createDistributionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  chainId: z.number().int().positive(),
  tokenAddress: addressSchema,
  tokenSymbol: z.string().trim().min(1).max(32),
  tokenDecimals: z.number().int().min(0).max(36),
  multisendAddress: addressSchema,
  recipients: z
    .array(recipientInputSchema)
    .min(1, "At least one recipient is required")
    // Guards the request body and the Merkle-free payload path against a
    // resource-exhaustion post; real lists are chunked client-side well below.
    .max(10_000, "Too many recipients in a single request"),
});

export type CreateDistributionInput = z.infer<typeof createDistributionSchema>;

/**
 * Sum recipient amounts. The authoritative total — never take it from input.
 */
export function computeTotal(recipients: { amount: string }[]): bigint {
  return recipients.reduce((sum, r) => sum + BigInt(r.amount), 0n);
}
