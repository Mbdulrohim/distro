# Product

## Register

product

## Platform

web

## Users

Primary: campaign creators — token projects, DAOs, and grant programs on Monad who need to distribute tokens to many recipients (airdrops, vesting, one-off payouts) without hand-rolling scripts or Merkle tooling. They operate the dashboard: upload a recipient list, deploy a campaign, fund it, monitor claims.

Secondary: recipients — wallet holders owed tokens. Their context is a claim portal, not the dashboard: connect a wallet, see what's claimable, claim it, done.

## Product Purpose

DISTRO is infrastructure for moving tokens from one project to many wallets, correctly, on Monad. It exists because every team currently rebuilds this from scratch with custom scripts and unaudited one-off contracts. Success is a creator going from "connect wallet" to a funded, live campaign with confidence that the contracts are sound and every recipient's status is visible and accurate — and a recipient claiming in one transaction with no confusion about eligibility.

## Positioning

The distribution layer teams trust with real funds because it's boring, correct, and audited — not a script you found in a Discord.

## Brand Personality

Precise, trustworthy, understated. Confident about correctness rather than hype — this product moves real money, so tone stays calm and clear even in error states. Terse UI copy; explanation lives in docs and tooltips, not crammed into buttons.

## Anti-references

Generic crypto/DeFi visual language: neon gradients, glassmorphism-heavy dashboards, degen/hype copy, excessive motion for its own sake. DISTRO should read closer to Stripe, Linear, Mercury, and Vercel than to a typical token-launch site.

## Design Principles

- Infrastructure-first: design serves the workflow (create → fund → claim), never decorates it.
- Precision over polish-for-its-own-sake: every state that involves money (review-before-deploy, claim confirmation, error states) gets a designed, unambiguous UI — no generic toasts standing in for financial confirmations.
- Say the risky thing plainly: irreversible actions (deploying a Merkle root, funding a campaign) are labeled as irreversible, not softened.
- Consistent with Stripe/Linear/Mercury/Vercel-tier minimalism: restrained color, clear type hierarchy, no ornamental crypto visual tropes.

## Accessibility & Inclusion

WCAG AA minimum, given the "enterprise-grade" bar stated for this product. No accessibility requirements beyond that were specified by the user; revisit if specific needs surface.

---
_Register and personality were defaulted (not user-confirmed) because the initiating question went unanswered — see docs/CTO_REVIEW.md and conversation history. Re-run `/impeccable init` to revise if these defaults are wrong._
