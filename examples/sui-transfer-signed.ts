import "dotenv/config";
import fs from "fs";
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { ethers } from "ethers";
import { UGFClient } from "@tychilabs/ugf-sdk";

const BACKEND_URL = "https://gateway.universalgasframework.com";
const SUI_RPC = getJsonRpcFullnodeUrl("mainnet");

const USER = process.env.SUI_CLIENT_ADDRESS!;
const USER_PK = process.env.USER_PRIVATE_KEY!;
const SUI_PK = process.env.SUI_CLIENT_PRIVATE_KEY!;
const RPC_BASE = process.env.RPC_BASE!;

if (!USER) throw new Error("Missing SUI_CLIENT_ADDRESS");
if (!USER_PK) throw new Error("Missing USER_PRIVATE_KEY");
if (!SUI_PK) throw new Error("Missing SUI_CLIENT_PRIVATE_KEY");

const provider = new ethers.JsonRpcProvider(RPC_BASE);
const wallet = new ethers.Wallet(USER_PK, provider);

const suiClient = new SuiJsonRpcClient({
  url: SUI_RPC,
  network: "mainnet",
});

const OUTPUT_DIR = "sui_signed_sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({ baseUrl: BACKEND_URL });

function save(name: string, data: any) {
  fs.writeFileSync(`${OUTPUT_DIR}/${name}`, JSON.stringify(data, null, 2));
}

async function buildTxKindB64() {
  const userCoins = await suiClient.getCoins({
    owner: USER,
    coinType: "0x2::sui::SUI",
  });
  if (!userCoins.data?.length) throw new Error("No SUI coins");

  const userCoin = userCoins.data.sort(
    (a: any, b: any) => Number(b.balance) - Number(a.balance),
  )[0];

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(userCoin.coinObjectId), [100_000]);
  tx.transferObjects([coin], USER);
  tx.setSender(USER);

  const bytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
  return Buffer.from(bytes).toString("base64");
}

/**
 * @notice Sui transfer via signature-based SDK path. Key never enters SDK.
 */
async function main() {
  const txKindB64 = await buildTxKindB64();

  await client.auth.login(wallet);

  const quote = await client.quote.get({
    payment_coin: "USDC",
    payer_address: wallet.address,
    payment_chain: "8453",
    payment_chain_type: "evm",
    tx_object: JSON.stringify({
      sui_address: USER,
      tx_kind_b64: txKindB64,
    }),
    dest_chain_id: "sui-mainnet",
    dest_chain_type: "sui",
  });
  save("1_quote.json", quote);

  // 1) Build x402 typed-data — no signer.
  const td = await client.payment.x402.buildTypedData(
    quote,
    wallet.address,
    provider,
  );

  // 2) App signs locally.
  const signature = await wallet.signTypedData(td.domain, td.types, td.message);

  // 3) Submit signed x402 to UGF.
  await client.payment.x402.submitSigned(
    quote,
    signature,
    td.nonce,
    td.valid_after,
    td.valid_before,
  );

  // 4) Wait for sponsor-provided tx bytes — no key.
  const { tx_bytes, sponsor_sig } = await client.chains.sui.waitForSponsorBytes(
    { digest: quote.digest },
  );
  save("2_sponsor_bytes.json", { tx_bytes, sponsor_sig });

  // 5) App signs Sui tx bytes locally with its own Ed25519 keypair.
  const keypair = Ed25519Keypair.fromSecretKey(SUI_PK);
  const bytes = Buffer.from(tx_bytes, "base64");
  const { signature: userSig } = await keypair.signTransaction(bytes);

  // 6) Broadcast with both sigs via SDK helper (Sui RPC only — no gateway call).
  const result = await client.chains.sui.executeSignedBlock({
    rpcUrl: SUI_RPC,
    txBytes: tx_bytes,
    userSig,
    sponsorSig: sponsor_sig,
  });
  save("3_execution.json", result);

  console.log("Done");
}

main().catch(console.error);
