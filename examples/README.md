# UGF SDK Examples

This folder contains minimal examples to run common UGF flows.

---

## Setup

Install dependencies:

```bash
npm install
````

Create a `.env` file:

```env
SERVICE_URL=https://gateway.universalgasframework.com

RPC_BASE=...
RPC_BNB=...

USER_PRIVATE_KEY=...
SOL_CLIENT_PRIVATE_KEY=...
```

---

## Run Examples

Solana SPL transfer:

```bash
npx tsx examples/sol-spl.ts
```

EVM execution (vault payment):

```bash
npx tsx examples/evm-vault.ts
```

---

## Files

* `sol-spl.ts`
  SPL token transfer on Solana
  Payment: $U (via x402 on BNB)

* `evm-vault.ts`
  EVM transaction with vault payment
  Payment: ETH (via vault on Base)

---

## Requirements

* Wallet must have funds on required chains
* Correct RPC URLs

---

## Notes

These are minimal examples for quick testing and integration.