# UX Punch List — first-time-user walkthrough

Traced the real path a new user takes: **landing → connect → sign → dashboard → new → token → recipients → review → send → results**, reading each component rather than guessing. Ordered by severity. Each item names the file so it's actionable.

Ground truth up front: **a completed distribution only exists on testnet/staging today.** In a production (mainnet-only) build, `Multisend` is deliberately unwired (unaudited), so the happy path ends at "Distro isn't deployed on this network." Everything below assumes staging, where the flow actually completes.

---

## P0 — blocks or misleads on the money action

**1. The "Distribute now" button doesn't distribute — it saves.** `distribution-review.tsx` shows a confirm button labelled **"Distribute now"**, gated behind the irreversibility checkbox. But in `create-flow.tsx` that button's `onConfirm` only **saves a draft** (`POST /api/distributions`). A _second_, differently-labelled button — "Distribute to N recipients" (`ExecutePanel`) — then appears below and does the actual sending. So on a money flow the user: ticks "I've reviewed", clicks a button that says it will distribute, and it doesn't — then has to find and click a different distribute button. Two competing "distribute" actions on screen at once. **Fixed** (this pass): after save, the review collapses to a single send view, and the review's own button is relabelled so it never claims to move money it isn't moving.

---

## P1 — correctness / trust

**2. The review's transaction count can be wrong.** `distribution-review.tsx` sizes batches with `maxRecipientsPerBatch()` (~475/batch, from the 30M tx-gas limit). `ExecutePanel` hardcodes `batchSize = 150`. For 400 recipients the review promises **"1 transaction to sign"** and execution then asks for **3**. The number shown at the irreversible moment must match what actually happens. **Fixed** (this pass): both paths now derive the batch size from the same `maxRecipientsPerBatch()`.

**3. No "no wallet installed" state.** `use-auth.ts` calls the injected connector; a user with no extension gets a raw connector error surfaced in `connect-wallet-button.tsx`, not the "install a wallet" guidance UX_SPEC S1 specified. Medium-high because it's the very first interaction for a share of users. _(Not fixed this pass — flagged.)_

---

## P2 — confusing interactions & dead ends

**4. Production is a dead end with no early warning.** A mainnet user can pick a token, import recipients, review, and save — and only _then_ hit "Distro isn't deployed on this network yet." The wall should be stated at the _start_ of the flow, not after the work. `create-flow.tsx` / `execute-panel.tsx`.

**5. "Open the dashboard" bounces you back to where you were.** On the landing, the secondary CTA links to `/dashboard`; unauthenticated, middleware redirects to `/?redirect=/dashboard`, re-rendering the same landing with a small notice at top. Reads as "the button did nothing." Consider having it trigger connect instead.

**6. Empty token list on testnet with no guidance.** The registry intentionally has no testnet tokens (`registry.ts`), so on staging the picker is empty and the user _must_ paste an address — but nothing says so. Needs a hint in `token-selector.tsx`.

**7. Nothing happens visibly after connecting on the landing.** Post-sign-in the user stays on the marketing page (header chip updates, but no forward motion). A first-timer may not realise they're in. Consider auto-advancing to `/dashboard` on the landing, or a clearer "You're in →" affordance.

---

## P3 — visual & copy inconsistencies (design-system drift)

**8. Table header fills disagree.** `distribution-review.tsx` still uses `bg-muted`; the dashboard and detail tables were standardised to `bg-surface`. Pick one (surface).

**9. Destructive-tint utilities are ad hoc.** Review uses `bg-destructive/10`; elsewhere the wired `bg-destructive-surface` token is used. Same for `border-destructive/30` vs the token. Consolidate on the semantic tokens from DESIGN.md.

**10. Corner radii drift.** Dashboard uses `rounded-xl`, the detail summary strip `rounded-lg`, review cards `rounded-lg`. Minor, but a premium surface is consistent. Standardise container radius.

**11. Status vocabulary isn't quite uniform.** Dashboard counters say "In flight / Needs attention"; `StatusBadge` says "In flight / Partial"; DB status is `submitted / partially_completed`. All defensible, but three vocabularies for the same states. Write them down once.

---

## What this pass fixes

P0 (#1) and P1 (#2) — the two that actually touch money and trust. The rest are logged here, honestly, rather than silently half-done: #3–#7 are real UX work, and #8–#11 are a design-system cleanup worth doing in one deliberate sweep rather than piecemeal.
