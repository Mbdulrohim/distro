# Deployments

One JSON file per network, recording what is deployed and where. Committed to git — a deployed address is a fact the whole repo depends on (`web/src/config/contracts.ts` must match), not local state.

## Files

- `monad-testnet.json` — chain 10143
- `monad-mainnet.json` — chain 143

## Shape

```jsonc
{
  "chainId": 10143,
  "contracts": {
    "Multisend": {
      "address": "0x…",
      "deployedAtBlock": 123456,
      "txHash": "0x…",
      "commit": "abc1234", // git commit of the source deployed
      "verified": true,
    },
  },
}
```

## After deploying

1. Record the address here **and** in `web/src/config/contracts.ts` — they must not drift.
2. Verify the contract (monskills `scaffold` skill — use the multi-explorer verification API, not `forge verify-contract` as a first resort).
3. Note the `commit` so the deployed bytecode is traceable to source.
