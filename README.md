# `UGF SDK (Beta)`

This SDK provides a simple interface to execute transactions across chains using UGF.

This is a beta release intended for review and early testing.
The SDK is functional and can be used with the provided examples.

---

## Install (Local)

```bash
npm link
```

In your project:

```bash
npm link @tychilabs/ugf-sdk
```

---

## Usage

Refer to the `examples/` folder:

- EVM execution (vault)
- Sui execution (x402)
- Solana SPL transfer (x402)
- Solana SOL transfer (x402)
- Solana custom transaction (x402)

---

## Requirements

- Node.js 18+
- Valid RPC endpoints
- Wallet with funds

---

## Browser / Vite Setup

> Required due to `@solana/web3.js` using Node.js globals (`Buffer`, `process`) in the browser.

> **Note:** Vite 8+ (Rolldown) is not yet supported. Use Vite 5.

```bash
npm install vite@5 @vitejs/plugin-react@4
npm install -D vite-plugin-node-polyfills
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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

## Notes

- Beta version — APIs may change
- Intended for testing and integration

---

## Contact

Author: [yash@tychilabs.com](mailto:yash@tychilabs.com)
For access, issues, or integration support, reach out via email.
