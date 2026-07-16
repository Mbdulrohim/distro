# Product

## Register

product

## Platform

web

## Users

Primary: distribution creators — Web3 startups, DAO contributors, community managers, NFT projects, and token issuers on Monad who need to pay many wallets at once (payroll, rewards, grants, airdrops, contributor payouts) without repeating transactions by hand. They operate the dashboard: create a distribution, import recipients, pick a token, schedule execution, approve, then track every payment.

Secondary: hackathon organizers, payroll teams, grant programs, freelancer agencies, and creator communities — the same workflow, less frequently, often on a deadline.

Recipients are **not** users. Distro is a push system: recipients receive tokens and never interact with the product. There is no recipient-facing surface.

## Product Purpose

Distro is an onchain distribution engine: it turns repetitive onchain transfers into a single automated workflow on Monad. It exists because blockchain made transferring assets permissionless but never made *distributing* them efficient — teams still copy addresses, repeat transactions, track status by hand, and retry failures manually. Success is a creator going from "connect wallet" to a funded, scheduled distribution in minutes, with every payment tracked in real time and verifiable onchain — and a scheduled payroll run that executes on time even if Distro's own infrastructure is down.

## Positioning

The distribution layer teams trust with payroll, because it's boring, correct, and can't miss a run — not a script you found in a Discord.

## Brand Personality

Precise, trustworthy, understated. Confident about correctness rather than hype — this product moves real money on a schedule, so tone stays calm and clear even in error states. Terse UI copy; explanation lives in docs and tooltips, not crammed into buttons.

## Anti-references

Generic crypto/DeFi visual language: neon gradients, glassmorphism-heavy dashboards, degen/hype copy, excessive motion for its own sake. Distro should read closer to Stripe, Linear, Mercury, and Vercel than to a typical token-launch site.

## Design Principles

- Infrastructure-first: design serves the workflow (create → import → schedule → approve → track), never decorates it.
- Precision over polish-for-its-own-sake: every state that involves money — the review step, funding, failures, retries — gets a designed, unambiguous UI. No generic toast standing in for a financial confirmation.
- Say the risky thing plainly: irreversible actions are labeled irreversible, not softened. In a push model a wrong address means the funds are simply gone.
- Show the truth about state, including lag: "confirmed onchain" and "shown in the dashboard" are different moments, and the UI must say so rather than imply failure.
- Restrained by default: Stripe/Linear/Mercury/Vercel-tier minimalism — clear type hierarchy, restrained color, no ornamental crypto tropes.

## Accessibility & Inclusion

WCAG AA minimum, given the "enterprise-grade" bar stated for this product. No accessibility requirements beyond that were specified by the user; revisit if specific needs surface.

---
_Register and personality were defaulted (not user-confirmed) because the initiating question went unanswered. Users/purpose/positioning are now grounded in the user-supplied product definition (2026-07-15). Re-run `/impeccable init` to revise._
