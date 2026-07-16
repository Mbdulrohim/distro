# API — Distro

Next.js route handlers backing the dashboard. Auth is SIWE session-cookie based unless noted.

> Supersedes the pre-definition draft (campaigns, Merkle proofs, claim eligibility) — Distro has no claim step and no recipient-facing API.

## Auth (implemented — Feature 1)

- `GET /api/auth/nonce` — issue a SIWE nonce (httpOnly cookie + body).
- `POST /api/auth/verify` — verify the signed SIWE message; issues the session cookie. Enforces Monad Mainnet (chain id 143) and the server-issued nonce.
- `GET /api/auth/me` — current session (`{ address, chainId }` or `{ address: null }`). Never 401s — it's a status probe.
- `POST /api/auth/logout` — clear the session. Idempotent.

## Distributions

- `POST /api/distributions` — create a draft (metadata only, pre-deploy). Body: `name`, `tokenAddress`, `executeAfter`, recipient list reference.
- `GET /api/distributions` — list the authenticated creator's distributions (paginated).
- `GET /api/distributions/:id` — detail + aggregates (recipient count, paid / failed / remaining, total escrowed).
- `POST /api/distributions/:id/chunks` — compute and persist chunk commitments (`chunk_hash` per chunk) from the validated recipient list, sized against Monad gas. Returns the chunk set for review before signing.
- `POST /api/distributions/:id/deployed` — record the deployed escrow address + tx hash once the creator's transaction confirms.
- `DELETE /api/distributions/:id` — soft-delete a draft only. Never touches a funded distribution (cancellation is an onchain action, not an API one).

## Recipients

- `GET /api/distributions/:id/recipients` — paginated recipient list with per-recipient status. Must support search/filter/sort — distributions run to thousands of rows.
- `GET /api/distributions/:id/recipients/export` — CSV export of the final result set.

## Uploads

- `POST /api/uploads/csv` — upload + validate a recipient CSV. Validates addresses, duplicates (warn, don't reject), amounts, and total-vs-balance. Stores the original in Supabase Storage and returns a reference plus structured per-row warnings/errors.

## Execution

Execution itself is **onchain and permissionless** — it is not an API operation. The API only *records and reports* it:

- `GET /api/distributions/:id/status` — execution progress derived from indexed events.

There is deliberately no "execute for me" endpoint that takes custody or acts on the user's behalf.

## Notes

- **Endpoints returning onchain-derived state must include `lastIndexedBlock`** so the UI can show freshness and render an explicit "syncing" state during indexer lag.
- **Write endpoints must be idempotent** — resubmitting a confirmed tx hash must not duplicate records.
- **Rate-limit** the upload and chunk-computation endpoints: both are computationally expensive and are an obvious abuse/DoS surface.
- **Server-side validation is authoritative.** Client-side validation is UX; it is never the security boundary. CSV parsing must also defend against formula injection and unbounded file size.
