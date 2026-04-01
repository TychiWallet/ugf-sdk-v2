# @tychilabs/ugf-sdk
[![npm](https://img.shields.io/npm/v/@tychilabs/ugf-sdk)](https://www.npmjs.com/package/@tychilabs/ugf-sdk)

> Gasless transactions for AI agents and Web3 apps — pay gas in stablecoins or native EVM coins across any chain via Universal Gas Framework

No paymasters. No bundlers. No ERC-4337. Just sign and execute.

---

## How it works

1. **Quote** — get a sponsored execution quote for your transaction
2. **Pay** — pay gas using USDC, EURC, $U (United Stables), or native EVM coins via x402 or vault
3. **Execute** — UGF sponsors the transaction on the destination chain

Your users never need the destination chain's gas token.

---

## Install

```bash
npm install @tychilabs/ugf-sdk
```

Peer dependencies — install only what you need:

```bash
npm install ethers                          # required (EVM payment)
npm install @mysten/sui                     # Sui only
npm install @solana/web3.js                 # Solana only
```

---

## Quick Start

### EVM → EVM

```ts
import { UGFClient } from "@tychilabs/ugf-sdk";
import { ethers } from "ethers";

const client = new UGFClient({
  baseUrl: "https://gateway.universalgasframework.com",
});
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

await client.auth.login(wallet);

const quote = await client.quote.get({
  payment_coin: "USDC",
  payer_address: wallet.address,
  payment_chain: "8453",
  payment_chain_type: "evm",
  tx_object: JSON.stringify({ from, to, data, value }),
  dest_chain_id: "56",
  dest_chain_type: "evm",
});

await client.payment.x402.execute({ quote, signer: wallet, token: "USDC" });
await client.chains.evm.execute({
  quote,
  signer: wallet.connect(destProvider),
});
```

### EVM → Solana

```ts
const quote = await client.quote.get({
  payment_coin: "USDC",
  payer_address: wallet.address,
  payment_chain: "8453",
  payment_chain_type: "evm",
  tx_object: JSON.stringify({
    sol_address: USER,
    transfer_type: "custom",
    tx_base64: txBase64,
  }),
  dest_chain_id: "sol-mainnet",
  dest_chain_type: "sol",
});

await client.payment.x402.execute({ quote, signer: wallet, token: "USDC" });
await client.chains.sol.sponsorCustomTx(
  quote.digest,
  keypair,
  connection,
  buildTx,
);
```

### EVM → Sui

```ts
const quote = await client.quote.get({
  payment_coin: "USDC",
  payer_address: wallet.address,
  payment_chain: "8453",
  payment_chain_type: "evm",
  tx_object: JSON.stringify({ sui_address: USER, tx_kind_b64: txKindB64 }),
  dest_chain_id: "sui-mainnet",
  dest_chain_type: "sui",
});

await client.payment.x402.execute({ quote, signer: wallet, token: "USDC" });
await client.chains.sui.execute({
  digest: quote.digest,
  keypair,
  rpcUrl: SUI_RPC,
});
```

---

## Payment Options

Payment options are returned dynamically in the quote response under `payment_options`. Supported tokens and chains expand over time as new partnerships are added — always refer to the quote response for the latest available options.

Current tokens include: **USDC, EURC, $U (United Stables), ETH, MATIC, AVAX, BNB**

```ts
GET https://gateway.universalgasframework.com/tokens/registry
```

---

## API

### Health check

```ts
GET https://gateway.universalgasframework.com/health
```

### Authentication

```ts
await client.auth.login(wallet); // signs a message to authenticate
```

---

## Browser / Vite Setup

> Vite 8+ (Rolldown) not yet supported. Use Vite 5.

```bash
npm install vite@5 @vitejs/plugin-react@4
npm install -D vite-plugin-node-polyfills
```

```ts
// vite.config.ts
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "process", "crypto"],
      globals: { Buffer: true, process: true },
    }),
  ],
});
```

---

## Compatibility

| Environment          | Status                     |
| -------------------- | -------------------------- |
| Node.js 18+          | Full support               |
| Vite 5 (React / Vue) | With polyfills             |
| Vite 8+              | Pending Rolldown ecosystem |
| React Native         | Coming soon                |

---

## Examples

See [`examples/`](./examples) for full runnable scripts:

- [`evm-vault.ts`](./examples/evm-vault.ts) — EVM vault payment
- [`sol-transfer.ts`](./examples/sol-transfer.ts) — Solana SOL transfer
- [`sol-spl.ts`](./examples/sol-spl.ts) — Solana SPL token transfer
- [`sol-custom.ts`](./examples/sol-custom.ts) — Solana custom tx
- [`sui-transfer.ts`](./examples/sui-transfer.ts) — Sui transfer

---

## About

[Tychi Labs](https://tychilabs.com) builds infrastructure for gasless and agentic Web3 execution. UGF is the gas abstraction protocol at the core — removing execution complexity for developers and AI agents across chains.

Built by [Yash](mailto:yash@tychilabs.com) at [Tychi Labs](https://tychilabs.com)

[X](https://x.com/0xyash) · [Telegram](https://t.me/singhy4sh) · [Issues](https://github.com/TychiWallet/ugf-sdk-v2/issues)
