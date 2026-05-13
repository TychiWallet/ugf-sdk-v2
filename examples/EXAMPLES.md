# UGF SDK Examples

This folder contains runnable examples for main UGF SDK flows.

These files are not just random scripts. Each one shows one complete route:

- where payment happens
- where action happens
- which SDK modules are used
- what user key signs
- what output files get written

If you are integrating UGF for first time, start here before building your own app flow.

---

## What These Examples Teach

All examples follow same high-level pattern:

1. create client
2. authenticate payer wallet
3. request quote
4. pay quote
5. finish destination-chain execution
6. save result

What changes between examples is destination chain and execution style.

- EVM example shows `vault` payment and destination EVM execution
- Solana examples show `x402` payment and three Solana execution styles
- Sui example shows `x402` payment and sponsored Sui execution

---

## Setup

Install dependencies:

```bash
npm install
```

Run scripts with:

```bash
npx tsx examples/<file>.ts
```

These examples write output JSON files into local folders like `case-1-sdk/`, `case-3-sdk/`, `evm_sdk/`, or `sui_sdk/`. Those files help you inspect quote payloads, payment proofs, and execution results after each run.

---

## Environment Variables

Create a `.env` file in project root.

```env
RPC_BASE=...
RPC_BNB=...

USER_PRIVATE_KEY=...
SOL_CLIENT_PRIVATE_KEY=...
SUI_CLIENT_ADDRESS=...
SUI_CLIENT_PRIVATE_KEY=...
```

What each value means:

| Variable | Meaning | Used by |
| -------- | ------- | ------- |
| `RPC_BASE` | Base mainnet RPC URL for EVM payer flows. | `sol-transfer.ts`, `sol-custom.ts`, `sui-transfer.ts`, `evm-vault.ts` |
| `RPC_BNB` | BNB Chain RPC URL for `$U` x402 payment or BNB destination execution. | `sol-spl.ts`, `evm-vault.ts` |
| `USER_PRIVATE_KEY` | EVM private key for payer wallet. This wallet logs in and pays quote. | all examples |
| `SOL_CLIENT_PRIVATE_KEY` | Solana user keypair in base58 secret key form. | `sol-transfer.ts`, `sol-spl.ts`, `sol-custom.ts` |
| `SUI_CLIENT_ADDRESS` | Sui address used as transaction sender. | `sui-transfer.ts` |
| `SUI_CLIENT_PRIVATE_KEY` | Sui private key used to sign sponsored Sui transaction. | `sui-transfer.ts` |

Important distinction:

- `USER_PRIVATE_KEY` is payment-side signer
- Solana and Sui keys are destination-side signers

UGF sits between those two sides.

---

## Example Index

| File | Payment side | Destination side | Main SDK methods |
| ---- | ------------ | ---------------- | ---------------- |
| `examples/sol-transfer.ts` | USDC on Base via `x402` | Native SOL transfer | `auth.login`, `quote.get`, `payment.x402.execute`, `chains.sol.sponsorSolTransfer` |
| `examples/sol-spl.ts` | `$U` on BNB via `x402` | SPL token transfer | `auth.login`, `quote.get`, `payment.x402.execute`, `chains.sol.sponsorSplTransfer` |
| `examples/sol-custom.ts` | USDC on Base via `x402` | Custom Solana tx | `auth.login`, `quote.get`, `payment.x402.execute`, `chains.sol.sponsorCustomTx` |
| `examples/sui-transfer.ts` | USDC on Base via `x402` | Sponsored Sui tx | `auth.login`, `quote.get`, `payment.x402.execute`, `chains.sui.execute` |
| `examples/evm-vault.ts` | ETH on Base via `vault` | EVM transfer on BNB | `auth.login`, `quote.get`, `payment.vault.submit`, `chains.evm.sponsorAndExecute` |
| `examples/evm-vault-signed.ts` | ETH on Base via `vault`, external-signing helpers | EVM transfer on BNB | `payment.vault.buildPaymentTx`, `payment.vault.submitSigned`, `chains.evm.waitForSponsorship`, `chains.evm.confirmUserTx` |
| `examples/sol-transfer-signed.ts` | USDC on Base via `x402`, external-signing helpers | Native SOL transfer | `payment.x402.buildTypedData`, `payment.x402.submitSigned`, `chains.sol.waitForUserSigMessage`, `chains.sol.submitUserSig` |
| `examples/sui-transfer-signed.ts` | USDC on Base via `x402`, external-signing helpers | Sponsored Sui tx | `payment.x402.buildTypedData`, `payment.x402.submitSigned`, `chains.sui.waitForSponsorBytes`, `chains.sui.executeSignedBlock` |

---

## Shared Concepts

### Quote

Every example calls `client.quote.get(...)`.

Quote is route description plus pricing. It returns:

- `digest` for tracking route
- `payment_amount`
- `payment_mode`
- `payment_to`
- chain-specific execution fields when needed

The most important input inside quote request is `tx_object`.

`tx_object` is destination action. It is always `JSON.stringify(...)` in these examples because UGF expects stringified payload.

### Authentication

Every example logs in payer wallet with:

```ts
await client.auth.login(wallet)
```

This proves payer wallet ownership and stores JWT inside SDK client automatically.

### Payment

There are two payment styles in examples:

- `x402`
  payer signs authorization payload and SDK submits it
- `vault`
  payer sends real on-chain payment tx first, then submits payment proof

### Execution

After payment, destination-side helper takes over:

- `chains.sol.*`
- `chains.sui.execute(...)`
- `chains.evm.sponsorAndExecute(...)`

These helpers finish route in chain-specific way.

---

## `examples/sol-transfer.ts`

This is simplest Solana example.

What it does:

- pays with `USDC` on Base
- asks UGF to sponsor native `SOL` transfer on Solana
- signs required Solana user signature
- waits until route completes

Why this example exists:

It shows standard sponsored transfer flow where UGF prepares Solana message and user signs only their required part.

Important values:

- `payment_coin: "USDC"`
- `payment_chain: "8453"`
- `dest_chain_id: "sol-mainnet"`
- `transfer_type: "sol_transfer"`

What happens inside script:

- EVM payer wallet logs in to UGF
- script requests quote for native SOL transfer
- payer settles quote with `client.payment.x402.execute(...)`
- SDK waits until route reaches `awaiting_user_sig`
- SDK signs returned Solana transfer message with `SOL_CLIENT_PRIVATE_KEY`
- SDK submits user signature back to UGF
- SDK polls until final completion

Output files:

- `case-1-sdk/1_quote.json`
  quote and route pricing
- `case-1-sdk/2_execution.json`
  final execution status

Use this example when:

- you want native SOL transfer
- you want cleanest Solana happy-path example

---

## `examples/sol-spl.ts`

This example shows SPL token transfer.

What it does:

- pays with `$U` on BNB
- asks UGF to sponsor SPL token transfer on Solana
- signs SPL transfer message with user Solana key
- waits for completion while printing status ticks

Why this example exists:

SPL transfer is different from native SOL transfer because token transfer message shape and signer lookup are different. This example shows that exact route.

Important values:

- `payment_coin: "$U"`
- `payment_chain: "56"`
- `transfer_type: "spl_transfer"`
- `mint`
  SPL token mint address

What happens inside script:

- payer wallet logs in
- script requests quote for SPL transfer payload
- payer settles quote using x402
- SDK waits for sponsored SPL message
- SDK signs the correct Solana user signature position
- SDK submits signature back to UGF
- SDK keeps polling until route completes

Extra thing this example shows:

- `onTick` callback for status logging during polling

Output files:

- `case-sdk/quote.json`
  quote response
- `case-sdk/result.json`
  final execution response

Use this example when:

- you want sponsored SPL transfer
- you want status logs while route is progressing

---

## `examples/sol-custom.ts`

This example shows custom Solana transaction flow.

What makes it different:

UGF does not build final destination action for you here. You provide custom transaction bytes for quoting, then later build and broadcast fresh user transaction after sponsorship is ready.

What it does:

- builds custom Solana transaction
- serializes it to base64 for quote payload
- pays with `USDC` on Base via x402
- waits for UGF-sponsored funding step
- builds fresh user transaction with latest blockhash
- broadcasts that user transaction

Why this example exists:

Many real apps do not only send native token transfers. They build custom Solana instructions. This example shows how UGF fits that model.

Important values:

- `transfer_type: "custom"`
- `tx_base64`
  serialized Solana transaction used for quote estimation

Two helper functions matter here:

- `buildQuotedTxBase64(connection)`
  creates transaction bytes used only for quoting
- `buildFreshUserTx(kp, blockhash)`
  creates fresh final transaction for real send after sponsorship is ready

Why two transaction builders:

- quoted transaction gives UGF enough information to price route
- fresh transaction avoids stale blockhash issue during real broadcast

What happens inside script:

- script opens Solana RPC connection
- script builds base64 transaction bytes for quote
- payer wallet logs in
- script requests quote for custom Solana action
- payer settles quote with x402
- SDK waits for route completion conditions
- script builds fresh Solana transaction using latest blockhash
- script signs and sends final transaction on Solana

Output files:

- `case-3-sdk/1_quote.json`
- `case-3-sdk/2_execution.json`

Use this example when:

- your Solana app builds custom instructions
- you need more than simple SOL or SPL transfer

---

## `examples/sui-transfer.ts`

This example shows sponsored Sui execution.

What it does:

- builds Sui transaction kind bytes
- pays with `USDC` on Base via x402
- waits until UGF returns sponsor transaction bytes and sponsor signature
- signs with user Sui key
- executes combined sponsored transaction block on Sui

Why this example exists:

Sui flow is different from both EVM and Solana. UGF returns sponsor data, then user signs and submits transaction block with both signatures.

Important values:

- `sui_address`
- `tx_kind_b64`
- `dest_chain_id: "sui-mainnet"`

What `buildTxKindB64()` does:

- reads user SUI coins
- picks one coin object
- creates transaction that splits coin and transfers result back to user
- builds transaction kind only
- base64-encodes bytes for quote request

What happens inside script:

- script prepares Sui transaction kind bytes
- payer wallet logs in
- script requests quote for Sui transaction
- payer settles quote with x402
- script loads Sui user keypair
- SDK polls until sponsor bytes and sponsor signature are ready
- SDK signs transaction with user keypair
- SDK executes sponsored Sui transaction block

Output files:

- `sui_sdk/1_quote.json`
- `sui_sdk/2_execution.json`

Use this example when:

- your destination chain is Sui
- you need full sponsor-signature execution flow

---

## `examples/evm-vault.ts`

This example shows EVM destination execution with vault payment.

What makes it different:

Payment is not x402 here. Script sends real on-chain vault payment transaction first, then submits proof of that payment back to UGF.

What it does:

- logs in on Base payer wallet
- gets quote for destination EVM transfer on BNB
- sends `payForFuel(...)` transaction to vault on Base
- waits for receipt
- submits vault payment proof
- waits for sponsorship readiness
- sends final destination EVM transaction on BNB
- confirms destination tx hash back to UGF

Why this example exists:

It shows native vault payment model and full EVM-to-EVM route where destination transaction is still user-broadcast.

Important values:

- `payment_coin: "ETH"`
- `payment_chain: "8453"`
- `dest_chain_id: "56"`
- `payment_mode: "vault"`

What happens inside script:

- script uses Base provider for payer side
- script uses BNB provider for destination side
- script reads BNB balance to pick transfer amount
- quote returns vault address in `payment_to`
- script manually encodes `payForFuel(bytes32 digest)`
- script sends native payment transaction to vault
- script submits `{ digest, tx_hash, payment_mode: "vault" }`
- SDK waits for sponsored route
- caller sends destination EVM transaction
- SDK confirms tx hash to UGF

Output files:

- `evm_sdk/1_quote.json`
- `evm_sdk/2_payment_tx.json`
- `evm_sdk/3_verification.json`
- `evm_sdk/5_final_tx.json`

Use this example when:

- you want native vault payment flow
- your destination action is EVM execution

---

## External-Signing Examples

These three examples cover the same routes as the ones above, but use the additional helper methods that split each flow into a build step and a submit step. The app signs locally with its own wallet. Same gateway endpoints, same payload bytes.

### `examples/evm-vault-signed.ts`

Same route as `evm-vault.ts` (ETH on Base → BNB transfer), using the external-signing helpers.

Flow:

- `payment.vault.buildPaymentTx(quote, payerAddress, "8453", "ETH", baseProvider)` returns unsigned EIP-1559 tx with `to`, `data`, `value`, `chainId`, `gasLimit`, `nonce`, `type: 2`, `maxFeePerGas`, `maxPriorityFeePerGas`
- app does `wallet.signTransaction(unsigned)` locally → broadcasts via `provider.broadcastTransaction` → waits receipt
- `payment.vault.submitSigned(quote, receipt.hash)` posts proof to UGF
- `chains.evm.waitForSponsorship(quote.digest)` polls — no signer
- app builds + signs + broadcasts destination tx itself
- `chains.evm.confirmUserTx(quote.digest, destTx.hash)` confirms back to UGF

Output dir: `evm_vault_signed_sdk/`

Use when the app prefers to sign and broadcast EVM txs itself (agent runtimes, remote signers, hardware wallets).

### `examples/sol-transfer-signed.ts`

Same route as `sol-transfer.ts` (USDC on Base → native SOL transfer), using the external-signing helpers.

Flow:

- `payment.x402.buildTypedData(quote, wallet.address, provider)` returns `{ domain, types, message, nonce, valid_after, valid_before }`
- app calls `wallet.signTypedData(domain, types, message)` locally
- `payment.x402.submitSigned(quote, signature, nonce, valid_after, valid_before)` posts to UGF
- `chains.sol.waitForUserSigMessage(quote.digest)` returns `serialized_message`
- app deserializes the message, signs with its Solana keypair locally, base64-encodes the user sig
- `chains.sol.submitUserSig(quote.digest, userSig)` posts to UGF
- `status.poll` (or `chains.evm.waitForSponsorship`) finishes the route

Output dir: `case-1-signed-sdk/`

Use when the app prefers to sign the Solana message itself.

### `examples/sui-transfer-signed.ts`

Same route as `sui-transfer.ts` (USDC on Base → sponsored Sui tx), using the external-signing helpers.

Flow:

- `payment.x402.buildTypedData` + local `signTypedData` + `payment.x402.submitSigned` settle payment
- `chains.sui.waitForSponsorBytes({ digest })` returns `{ tx_bytes, sponsor_sig }`
- app signs `tx_bytes` locally with its own `Ed25519Keypair` → produces `userSig`
- `chains.sui.executeSignedBlock({ rpcUrl, txBytes, userSig, sponsorSig })` broadcasts via Sui RPC (no gateway call)

Output dir: `sui_signed_sdk/`

Use when the app prefers to sign the Sui tx bytes itself.

### Pairings at a glance

| Existing | External-signing pair |
| -------- | --------------------- |
| `payment.vault.payAndSubmit` | `payment.vault.buildPaymentTx` + `submitSigned` |
| `payment.x402.execute` | `payment.x402.buildTypedData` + `submitSigned` |
| `chains.evm.sponsorAndExecute` | `chains.evm.waitForSponsorship` + `confirmUserTx` |
| `chains.sol.sponsorSolTransfer` | `chains.sol.waitForUserSigMessage` + `submitUserSig` |
| `chains.sui.execute` | `chains.sui.waitForSponsorBytes` + `executeSignedBlock` |

---

## Which Example Should You Start With

Start with:

- `sol-transfer.ts`
  if you want easiest x402 example
- `evm-vault.ts`
  if you need vault flow
- `sol-custom.ts`
  if your app builds custom Solana transactions
- `sui-transfer.ts`
  if your target chain is Sui
- `sol-spl.ts`
  if your destination action is SPL token transfer

---

## Common Patterns You Can Reuse

Patterns repeated across examples:

- `new UGFClient({ baseUrl })`
- `await client.auth.login(wallet)`
- `await client.quote.get(...)`
- `await client.payment.x402.execute(...)`
- `await client.payment.vault.submit(...)`
- destination helper call under `client.chains.*`

Good reuse points for your own app:

- keep one shared `UGFClient`
- stringify `tx_object`
- separate payment signer from destination signer if chains differ
- store `quote.digest`
- save quote and execution response while debugging

---

## Common Mistakes

- forgetting `JSON.stringify(...)` around `tx_object`
- using payer key where destination-chain key is needed
- missing provider on EVM signer
- using wrong RPC for payment chain
- using stale blockhash for custom Solana transaction
- missing env variables
- assuming x402 and vault flows are interchangeable

---

## What Is Missing

Current examples cover EVM, Solana, and Sui.

Tron support exists in SDK, but runnable Tron examples are not included in this folder yet.

Planned example shape:

- `examples/tron-trx.ts`
- `examples/tron-trc20.ts`

---

## Final Read

If you are evaluating SDK surface quickly:

- read `sol-transfer.ts` for clean x402 flow
- read `evm-vault.ts` for vault flow
- read `sol-custom.ts` for custom destination execution pattern
- read `sui-transfer.ts` for sponsor-signature execution pattern

These examples are best used as integration reference, not production app architecture. Keep secrets out of frontend, add your own retries and observability, and replace hardcoded example values with app data.
