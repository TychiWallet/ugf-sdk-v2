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

const OUTPUT_DIR = "evm_sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({ baseUrl: SERVICE_URL });

function save(name: string, data: any) {
  fs.writeFileSync(`${OUTPUT_DIR}/${name}`, JSON.stringify(data, null, 2));
}

async function main() {
  console.log("User:", userAddress);

  await client.auth.login(wallet.connect(baseProvider));
  console.log("Logged in");

  const balance = await bnbProvider.getBalance(userAddress);
  const halfBalance = balance / 5n;

  console.log("BNB balance:", balance.toString());
  console.log("Sending:", halfBalance.toString());

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

  console.log("Quote digest:", quote.digest);
  save("1_quote.json", quote);

  const baseWallet = wallet.connect(baseProvider);

  const vaultAddress = quote.payment_to;
  const paymentAmount = BigInt(quote.payment_amount);
  const digest = quote.digest;

  const iface = new ethers.Interface([
    "function payForFuel(bytes32 digest) payable",
  ]);

  const data = iface.encodeFunctionData("payForFuel", [digest]);

  console.log("Sending vault payment...");
  console.log({
    digest,
    vaultAddress,
    paymentAmount: paymentAmount.toString(),
  });

  const tx = await baseWallet.sendTransaction({
    to: vaultAddress,
    value: paymentAmount,
    data,
  });

  console.log("Payment tx:", tx.hash);
  save("2_payment_tx.json", { tx_hash: tx.hash });

  console.log("Waiting for confirmation...");
  await new Promise((r) => setTimeout(r, 15000));

  const verify = await client.payment.vault.submit({
    digest,
    tx_hash: tx.hash,
    payment_mode: "vault",
  });

  console.log("Verified:", verify.status);
  save("3_verification.json", verify);

  const bnbWallet = wallet.connect(bnbProvider);

  const { userTxHash } = await client.chains.evm.sponsorAndExecute(
    digest,
    bnbWallet,
    async (signer) => {
      return signer.sendTransaction({
        to: "0x51a2ab2FFf69a146A6E4231414aCC7727897B1ad",
        value: halfBalance,
      });
    },
  );

  console.log("Final tx:", userTxHash);
  save("5_final_tx.json", { tx_hash: userTxHash });
  console.log("Done");
}

main().catch(console.error);
