# UGF SDK Examples

This folder contains minimal examples to run common UGF flows.

---

## Setup

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

Solana Native SOL transfer:

```bash
npx tsx examples/sol-transfer.ts
```

Solana custom transaction:

```bash
npx tsx examples/sol-custom.ts
```

EVM execution (vault payment):

```bash
npx tsx examples/evm-vault.ts
```

Sui execution:

```bash
npx tsx examples/sui-transfer.ts
```

---

## Files

- `sol-spl.ts`
  SPL token transfer on Solana
  Payment: $U (United Stables) (x402 on BNB)

- `sol-custom.ts`
  Custom Solana transaction (user-built)
  Payment: USDC (Circle) (x402 on Base)

- `sol-transfer.ts`  
  Native SOL transfer  
  Payment: USDC (Circle) (x402 on Base)

- `evm-vault.ts`
  EVM transaction execution
  Payment: ETH (vault on Base)

- `sui-transfer.ts`
  Sui transaction execution
  Payment: USDC (Circle) (x402 on Base)

---

## Requirements

- Wallet must have funds on required chains
- Correct RPC URLs

---

## Notes

Minimal examples for testing and integration.
