import "dotenv/config";
import fs from "fs";
import bs58 from "bs58";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
import { UGFClient } from "@tychilabs/ugf-sdk";

const SERVICE_URL = "https://gateway.universalgasframework.com";

const RPC_BNB = process.env.RPC_BNB!;
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY!;
const SOL_CLIENT_PRIVATE_KEY = process.env.SOL_CLIENT_PRIVATE_KEY!;

if (!RPC_BNB) throw new Error("Missing RPC_BNB");
if (!USER_PRIVATE_KEY) throw new Error("Missing USER_PRIVATE_KEY");
if (!SOL_CLIENT_PRIVATE_KEY) throw new Error("Missing SOL_CLIENT_PRIVATE_KEY");

const provider = new ethers.JsonRpcProvider(RPC_BNB);
const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

const keypair = Keypair.fromSecretKey(bs58.decode(SOL_CLIENT_PRIVATE_KEY));
const USER = keypair.publicKey.toBase58();
const DEST = USER;

const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const AMOUNT = "0.01";

const OUTPUT_DIR = "case-sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({
  baseUrl: SERVICE_URL,
});

/**
 * @notice Runs sponsored SPL transfer example.
 */
async function main() {
  console.log("User:", USER);
  console.log("Payer:", wallet.address);

  // Log in with EVM payer wallet before requesting quote.
  await client.auth.login(wallet);
  console.log("Logged in");

  // Ask UGF for route pricing to sponsor SPL token transfer.
  const quote = await client.quote.get({
    payment_coin: "$U",
    payment_chain: "56",
    payer_address: wallet.address,
    payment_chain_type: "evm",
    tx_object: JSON.stringify({
      sol_address: USER,
      transfer_type: "spl_transfer",
      to: DEST,
      amount: AMOUNT,
      mint: MINT,
    }),
    dest_chain_id: "sol-mainnet",
    dest_chain_type: "sol",
  });

  console.log("Quote received:", quote.digest);

  fs.writeFileSync(
    `${OUTPUT_DIR}/quote.json`,
    JSON.stringify(quote, null, 2),
  );

  // Pay quote on EVM payment chain using x402.
  await client.payment.x402.execute({
    quote,
    signer: wallet,
    token: "$U",
  });

  console.log("Payment done");

  // Wait for sponsored SPL transfer message, sign it, and finish route.
  const result = await client.chains.sol.sponsorSplTransfer(
    quote.digest,
    keypair,
    {
      onTick: (s, i) => console.log(`[${i}]`, s.status),
    },
  );

  console.log("Completed:", result.signature);

  fs.writeFileSync(
    `${OUTPUT_DIR}/result.json`,
    JSON.stringify(result, null, 2),
  );
}

main().catch(console.error);
