import { formatUnits } from "viem";

/**
 * Display helpers. The database and contract only ever see base units; these
 * convert back to human units for the UI, and only for the UI.
 *
 * DESIGN.md's Monospace Money Rule applies wherever these render: always in
 * Geist Mono with tabular figures.
 */

/** Base units → a human-readable amount string against token decimals. */
export function formatAmount(base: bigint, decimals: number): string {
  return formatUnits(base, decimals);
}

/** Base units → "1,234.5 USDC", grouped for legibility. */
export function formatAmountWithSymbol(base: bigint, decimals: number, symbol: string): string {
  const human = formatUnits(base, decimals);
  const [whole, fraction] = human.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const joined = fraction ? `${grouped}.${fraction}` : grouped;
  return `${joined} ${symbol}`;
}
