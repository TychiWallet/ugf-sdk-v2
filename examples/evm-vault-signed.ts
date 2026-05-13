import "dotenv/config";
import fs from "fs";
import { ethers } from "ethers";
import { UGFClient } from "@tychilabs/ugf-sdk";

const SERVICE_URL = "https://gateway.universalgasframework.com";

const RPC_BASE = process.env.RPC_BASE!;
const RPC_BNB = process.env.RPC_BNB!;
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY!;

if (!RPC_BASE) throw new Error("Missing RPC_BASE");
if (!RPC_BNB) throw new Error("Missing RPC_BNB");
if (!USER_PRIVATE_KEY) throw new Error("Missing USER_PRIVATE_KEY");

const baseProvider = new ethers.JsonRpcProvider(RPC_BASE);
const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);

const wallet = new ethers.Wallet(USER_PRIVATE_KEY);
const userAddress = wallet.address;

const OUTPUT_DIR = "evm_vault_signed_sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({ baseUrl: SERVICE_URL });

function save(name: string, data: any) {
  fs.writeFileSync(
    `${OUTPUT_DIR}/${name}`,
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  );
}

/**
 * @notice EVM vault flow via signature-based SDK path. Key never enters SDK.
 */
async function main() {
  console.log("User:", userAddress);

  await client.auth.login(wallet.connect(baseProvider));

  const balance = await bnbProvider.getBalance(userAddress);
  const halfBalance = balance / 5n;

  const quote = await client.quote.get({
    payment_coin: "ETH",
    payer_address: userAddress,
    payment_chain: "8453",
    payment_chain_type: "evm",
    tx_object: JSON.stringify({
      from: userAddress,
      to: "0x51a2ab2FFf69a146A6E4231414aCC7727897B1ad",
      data: "0x",
      value: halfBalance.toString(),
    }),
    dest_chain_id: "56",
    dest_chain_type: "evm",
  });
  save("1_quote.json", quote);

  // 1) SDK builds unsigned vault tx — no signer involved.
  const unsigned = await client.payment.vault.buildPaymentTx(
    quote,
    userAddress,
    "8453",
    "ETH",
    baseProvider,
  );
  save("2_unsigned_tx.json", unsigned);

  // 2) App signs locally — key stays in app process.
  const localBase = wallet.connect(baseProvider);
  const signedRaw = await localBase.signTransaction(unsigned);

  // 3) App broadcasts and waits for receipt.
  const broadcast = await baseProvider.broadcastTransaction(signedRaw);
  const receipt = await broadcast.wait();
  if (!receipt) throw new Error("No receipt");
  save("3_payment_tx.json", { tx_hash: receipt.hash });

  // 4) Tell UGF about the broadcast tx.
  const verify = await client.payment.vault.submitSigned(quote, receipt.hash);
  save("4_verification.json", verify);

  // 5) Wait for sponsor — no signer.
  await client.chains.evm.waitForSponsorship(quote.digest);

  // 6) App builds + signs + broadcasts destination tx locally.
  const localBnb = wallet.connect(bnbProvider);
  const destTx = await localBnb.sendTransaction({
    to: "0x51a2ab2FFf69a146A6E4231414aCC7727897B1ad",
    value: halfBalance,
  });
  await destTx.wait();

  // 7) Confirm destination tx hash back to UGF.
  await client.chains.evm.confirmUserTx(quote.digest, destTx.hash);
  save("5_final_tx.json", { tx_hash: destTx.hash });

  console.log("Done");
}

main().catch(console.error);
