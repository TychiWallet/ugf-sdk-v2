# UGF SDK Examples

This folder contains minimal examples to run common UGF flows.

---

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
SERVICE_URL=https://gateway.universalgasframework.com

RPC_BASE=...
RPC_BNB=...

USER_PRIVATE_KEY=...
SOL_CLIENT_PRIVATE_KEY=...
SUI_CLIENT_ADDRESS=...
SUI_CLIENT_PRIVATE_KEY=...
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

Sui execution:

```bash
npx tsx examples/sui.ts
```

---

## Files

- `sol-spl.ts`
  SPL token transfer on Solana
  Payment: $U (United Stables) (via x402 on BNB)

- `evm-vault.ts`
  EVM transaction with vault payment
  Payment: ETH (via vault on Base)

- `sui.ts`
  Sui transaction execution
  Payment: USDC (Circle) (via x402 on Base)

---

## Requirements

- Wallet must have funds on required chains
- Correct RPC URLs

---

## Notes

These are minimal examples for quick testing and integration.
