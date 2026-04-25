import "dotenv/config";
import fs from "fs";
import bs58 from "bs58";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
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

const OUTPUT_DIR = "case-1-sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({
  baseUrl: SERVICE_URL,
});

/**
 * @notice Saves example output to local file.
 * @param name Output file name.
 * @param data JSON data to write.
 */
function save(name: string, data: any) {
  fs.writeFileSync(`${OUTPUT_DIR}/${name}`, JSON.stringify(data, null, 2));
}

/**
 * @notice Runs sponsored SOL transfer example.
 */
async function main() {
  // Log in with EVM payer wallet before requesting quote.
  await client.auth.login(wallet);

  // Ask UGF for route pricing to sponsor native SOL transfer.
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

  // Pay quote on EVM payment chain using x402.
  await client.payment.x402.execute({
    quote,
    signer: wallet,
    token: "USDC",
  });

  // Wait for sponsored Solana transfer message, sign it, and finish route.
  const result = await client.chains.sol.sponsorSolTransfer(
    quote.digest,
    keypair,
  );

  save("2_execution.json", result);
}

main().catch(console.error);
