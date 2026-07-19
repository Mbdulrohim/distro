# Features — Distro

> Maps to the four product pillars in [PRD.md](PRD.md): Distribution, Scheduling, Automation, Tracking. Push model — recipients never claim.

## Distribution

- Create a distribution: name it, pick the token, import recipients.
- **Import recipients** via CSV (`address,amount`), or paste a list.
- **Validation before anything is signed** — this is safety-critical, not polish. In a push model a wrong address means funds are irreversibly gone.
  - Invalid / malformed addresses.
  - Duplicate addresses (flag; let the user merge or keep intentionally).
  - Zero or negative amounts.
  - Total required vs. the creator's actual token balance.
  - Explicit, unambiguous units — see "Decimals" below.
- **Review step** showing the full committed state (recipient count, total amount, token, schedule) with an unmistakable "this is irreversible" moment before signing.
- Chunking is computed for the user; the dashboard sizes chunks to Monad's gas reality and shows the estimated cost.
- **Fund when you choose, not at creation.** Funding is decoupled from creation ([CONTRACT_SPEC.md](CONTRACT_SPEC.md)) — schedule Friday's payroll on Monday, fund it Thursday night. The lock-up window is the creator's decision.
- **A "Ready but unfunded" distribution silently does nothing at its scheduled time.** That is a contract-level no-op, which makes it a product-level obligation: the dashboard must make an unfunded-but-scheduled distribution impossible to miss, and it is the single best argument for shipping notifications sooner than v2.
- **Test payment** — send to one recipient before committing the full run. Every payroll operator's first instinct before moving $200k, and there is otherwise no non-destructive way to rehearse an irreversible action.

## Scheduling

- **Execute now** — run as soon as funding confirms.
- **Execute later** — pick a future date/time; the escrow enforces it onchain (`executeAfter`).
- Clear display of scheduled time in the user's local timezone _and_ UTC — payroll gets sent to the wrong day otherwise.
- **Cancel + full refund any time before execution begins** — gated on execution progress, not the clock, so a creator can call off Friday's payroll on Friday morning.
  - This means a scheduled distribution is a **promise, not a guarantee** — right for payroll, questionable for bounties/grants where credible commitment is the point. Whether v1 offers an opt-in irrevocable mode is an open decision (O1 in [CONTRACT_SPEC.md](CONTRACT_SPEC.md)) that cannot be retrofitted into an immutable contract.

## Automation

- Distro's keeper triggers scheduled distributions automatically — a **convenience, not a dependency**. If the keeper is down, the creator (or anyone) can trigger the run themselves; the dashboard always exposes a manual "Execute now" path.
- That fallback is only real because the recipient list is emitted onchain — anyone can rebuild a chunk from logs and execute it without Distro's database. Whether a _stranger_ would ever bother is a separate question, unresolved (see O2 in [CONTRACT_SPEC.md](CONTRACT_SPEC.md)); today the honest claim is "the creator can always self-serve", not "a keeper ecosystem exists".
- **Retry failed payments** — failures are isolated per recipient, surfaced in the dashboard, and retryable in one click without re-running successful payments.
- Recurring schedules are **v2** — see [ROADMAP.md](ROADMAP.md).

## Tracking

- Live per-recipient status: `pending → paid | failed`, reconciled from onchain events.
- Distribution-level progress: paid / failed / remaining, total distributed vs. escrowed.
- Every row links to its transaction on a Monad explorer — "verifiable onchain" has to be one click, not a promise.
- Export the result as CSV for the creator's own records/accounting.
- Per-distribution audit timeline (created → funded → executed → completed).

## Cross-cutting

### Decimals

CSV amounts are entered in **human units** (`100.5`), converted to base units against the token's `decimals` at commit time, and displayed converted back. The ambiguity between the two is a top cause of real-world distribution bugs — the review step shows both.

### Token support

ERC-20 only in v1. Fee-on-transfer and rebasing tokens are **rejected at funding** (balance-delta check), not silently mishandled. ERC-777/callback tokens are excluded.

### Network

Monad Mainnet only. A persistent, unmissable network indicator — with real funds at stake, an accidental wrong-network action must be hard to perform.

### Data

Offchain (Neon Postgres) data is an index/cache over onchain state for fast dashboard queries. **The chain is the source of truth** — the schema must be reconstructable from onchain events plus creator-supplied metadata.

### Not in v1

Notifications (email/webhook) on completion/failure, team accounts, and public distribution pages — see [ROADMAP.md](ROADMAP.md) and the gaps flagged in [CTO_REVIEW.md](CTO_REVIEW.md).
