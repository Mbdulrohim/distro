# PRD — Distro

> Source of truth for what Distro is. Supersedes the pre-definition drafts (which described a claim-based Merkle/vesting product — that was never Distro).

## What Distro is

**Distro is an onchain distribution engine.** It enables individuals, teams, and organizations to automate token distributions at scale on Monad.

Instead of manually sending payments to dozens or hundreds of wallets, a user creates a distribution, imports recipients, schedules execution, and Distro handles the rest — executing onchain and tracking every payment in real time.

**Mission:** simplify how digital assets are distributed onchain.

**Vision:** become the distribution infrastructure powering payroll, rewards, grants, airdrops, and recurring payouts across Web3.

## Why Distro exists

Blockchain made transferring assets permissionless. It didn't make _distributing_ assets efficient. Distro fills that gap.

## Problem

Distributing assets onchain is still unnecessarily manual. Teams repeatedly copy wallet addresses, verify them, enter amounts, repeat transactions, track payment status, retry failed transfers, and keep records by hand. As recipient lists grow, the process gets slower, more error-prone, and harder to manage.

## Solution

Distro automates the entire distribution workflow:

1. Create a distribution
2. Import recipients
3. Select a token
4. Choose when to execute
5. Approve

Distro securely executes the distribution onchain while tracking every payment in real time.

## Product pillars

| Pillar           | Meaning                                          |
| ---------------- | ------------------------------------------------ |
| **Distribution** | Send assets to many recipients efficiently.      |
| **Scheduling**   | Execute distributions at a future date and time. |
| **Automation**   | Reduce manual work for recurring payouts.        |
| **Tracking**     | Know exactly who has been paid and when.         |

**Transparency:** every distribution is verifiable onchain.

## Users

**Primary:** Web3 startups · DAO contributors · community managers · NFT projects · token issuers

**Secondary:** hackathon organizers · payroll teams · grant programs · freelancer agencies · creator communities

## Use cases

Monthly payroll · community rewards · airdrops · bug bounty payouts · hackathon prizes · grant distributions · creator revenue sharing · affiliate payouts · scholarship payments · DAO contributor compensation

## What Distro is / is not

**Is:** distribution platform · automation tool · payment scheduler · payroll engine · reward distribution system · treasury distribution infrastructure

**Is not:** wallet · exchange · bridge · bank · **custodian** · portfolio tracker

The "not a custodian" line is load-bearing — it constrains the execution architecture (see [CONTRACT_SPEC.md](CONTRACT_SPEC.md)).

## Why Monad

Large-scale distributions demand fast execution, low transaction costs, and high throughput. Monad lets Distro process recurring and bulk distributions efficiently without compromising user experience.

## Core model: push, not claim

Distro is a **push** system. The sender distributes; recipients do nothing and need no interaction. There is no claim step, no Merkle proof, no eligibility portal. Recipients receive tokens directly.

This is the single most important architectural fact about the product.

## Scope — v1

- **One-off distributions**: execute immediately on approval.
- **Scheduled distributions**: execute once, at a chosen future date/time.
- Recipient import via CSV (address + amount), with validation.
- Single token per distribution, ERC-20 only.
- Dashboard: create → import → select token → schedule → approve → track.
- Real-time per-recipient payment tracking, verifiable onchain.
- Monad Mainnet only.

## Out of scope — v1

- Recurring/repeating schedules (v2 — see [ROADMAP.md](ROADMAP.md)).
- Native MON distribution (ERC-20 only in v1).
- NFT/ERC-721 distribution.
- Multi-chain.
- Fiat on/off-ramp.
- Team/multi-user accounts (see [CTO_REVIEW.md](CTO_REVIEW.md) — flagged as a gap).

## Success metrics

- Time from "connect wallet" to "distribution executing" under 10 minutes for a first-time user.
- Distribution execution success rate > 99% (no failures attributable to platform bugs).
- Zero funds lost or stuck due to contract bugs. This is the bar, not a stretch goal.
- A scheduled distribution executes on time **even if Distro's own infrastructure is down**.

## Key risks

- **Contract security** — distribution contracts hold real funds in escrow; needs thorough testing and an external audit before mainnet.
- **Execution liveness** — a payroll engine that misses payroll is a dead product. Execution must not depend on Distro being alive (see [CONTRACT_SPEC.md](CONTRACT_SPEC.md)).
- **Recipient list correctness** — a wrong address in a push model means funds are gone irreversibly. Validation and an explicit review step are safety-critical, not polish.
- **Monad-specific behavior** — gas is charged on `gas_limit` not gas used; confirm assumptions via the `monskills` `gas` and `concepts` skills rather than porting Ethereum assumptions.
