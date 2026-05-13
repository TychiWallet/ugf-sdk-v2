import "dotenv/config";
import fs from "fs";
import bs58 from "bs58";
import { ethers } from "ethers";
import {
  Keypair,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { UGFClient } from "@tychilabs/ugf-sdk";

const SERVICE_URL = "https://gateway.universalgasframework.com";

const RPC_BASE = process.env.RPC_BASE!;
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY!;
const SOL_CLIENT_PRIVATE_KEY = process.env.SOL_CLIENT_PRIVATE_KEY!;

if (!RPC_BASE) throw new Error("Missing RPC_BASE");
if (!USER_PRIVATE_KEY) throw new Error("Missing USER_PRIVATE_KEY");
if (!SOL_CLIENT_PRIVATE_KEY) throw new Error("Missing SOL_CLIENT_PRIVATE_KEY");

const provider = new ethers.JsonRpcProvider(RPC_BASE);
const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

const keypair = Keypair.fromSecretKey(bs58.decode(SOL_CLIENT_PRIVATE_KEY));
const USER = keypair.publicKey.toBase58();
const DEST = USER;
const AMOUNT = "1000";

const OUTPUT_DIR = "case-1-signed-sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({ baseUrl: SERVICE_URL });

function save(name: string, data: any) {
  fs.writeFileSync(`${OUTPUT_DIR}/${name}`, JSON.stringify(data, null, 2));
}

/**
 * @notice SOL transfer via signature-based SDK path. Key never enters SDK.
 */
async function main() {
  await client.auth.login(wallet);

  const quote = await client.quote.get({
    payment_coin: "USDC",
    payer_address: wallet.address,
    payment_chain: "8453",
    payment_chain_type: "evm",
    tx_object: JSON.stringify({
      sol_address: USER,
      transfer_type: "sol_transfer",
      to: DEST,
      amount: AMOUNT,
    }),
    dest_chain_id: "sol-mainnet",
    dest_chain_type: "sol",
  });
  save("1_quote.json", quote);

  // 1) Build x402 typed-data — no signer.
  const td = await client.payment.x402.buildTypedData(
    quote,
    wallet.address,
    provider,
  );

  // 2) App signs typed-data locally.
  const signature = await wallet.signTypedData(td.domain, td.types, td.message);

  // 3) Submit signature to UGF.
  await client.payment.x402.submitSigned(
    quote,
    signature,
    td.nonce,
    td.valid_after,
    td.valid_before,
  );

  // 4) Poll until UGF returns the serialized message — no signing.
  const sigStatus = await client.chains.sol.waitForUserSigMessage(quote.digest);
  const msgB64 = sigStatus.serialized_message!;
  save("2_serialized_message.json", { serialized_message: msgB64 });

  // 5) App signs the message locally with its Solana keypair.
  const msgBuffer = Buffer.from(msgB64, "base64");
  const versionedMsg = VersionedMessage.deserialize(msgBuffer);
  const vTx = new VersionedTransaction(versionedMsg);
  vTx.sign([keypair]);
  // sponsor=0, user=1
  const userSig = Buffer.from(vTx.signatures[1]).toString("base64");

  // 6) Submit user sig back to UGF.
  await client.chains.sol.submitUserSig(quote.digest, userSig);

  // 7) Poll terminal status.
  const finalStatus = await client.chains.evm.waitForSponsorship(quote.digest);
  save("3_execution.json", finalStatus);

  console.log("Done");
}

main().catch(console.error);
