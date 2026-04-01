import "dotenv/config";
import fs from "fs";
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { ethers } from "ethers";
import { UGFClient } from "@tychi/ugf-sdk";

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

const OUTPUT_DIR = "sui_sdk";
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

  if (!userCoins.data?.length) {
    throw new Error("No SUI coins found");
  }

  const userCoin = userCoins.data.sort(
    (a: any, b: any) => Number(b.balance) - Number(a.balance),
  )[0];

  const tx = new Transaction();

  const [coin] = tx.splitCoins(tx.object(userCoin.coinObjectId), [100_000]);
  tx.transferObjects([coin], USER);
  tx.setSender(USER);

  const bytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });

  return Buffer.from(bytes).toString("base64");
}

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

  await client.payment.x402.execute({
    quote,
    signer: wallet,
    token: "USDC",
  });

  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const keypair = Ed25519Keypair.fromSecretKey(SUI_PK);

  const result = await client.chains.sui.execute({
    digest: quote.digest,
    keypair,
    rpcUrl: SUI_RPC,
  });

  save("2_execution.json", result);
}

main().catch(console.error);
