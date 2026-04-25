import "dotenv/config";
import fs from "fs";
import bs58 from "bs58";
import { ethers } from "ethers";
import {
  Connection,
  Transaction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { UGFClient } from "@tychilabs/ugf-sdk";

const BACKEND_URL = "https://gateway.universalgasframework.com";
const SOL_RPC = "https://api.mainnet-beta.solana.com";

const USER_PK = process.env.SOL_CLIENT_PRIVATE_KEY!;
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY!;
const RPC_BASE = process.env.RPC_BASE!;

if (!USER_PK) throw new Error("Missing SOL_CLIENT_PRIVATE_KEY");
if (!USER_PRIVATE_KEY) throw new Error("Missing USER_PRIVATE_KEY");
if (!RPC_BASE) throw new Error("Missing RPC_BASE");

const provider = new ethers.JsonRpcProvider(RPC_BASE);
const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

const keypair = Keypair.fromSecretKey(bs58.decode(USER_PK));
const USER = keypair.publicKey.toBase58();

const OUTPUT_DIR = "case-3-sdk";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const client = new UGFClient({
  baseUrl: BACKEND_URL,
});

/**
 * @notice Saves example output to local file.
 * @param name Output file name.
 * @param data JSON data to write.
 */
function save(name: string, data: unknown) {
  fs.writeFileSync(`${OUTPUT_DIR}/${name}`, JSON.stringify(data, null, 2));
}

/**
 * @notice Builds quoted custom Solana tx payload.
 * @param connection Solana RPC connection.
 * @returns Base64 serialized transaction.
 */
async function buildQuotedTxBase64(connection: Connection): Promise<string> {
  const userPubkey = keypair.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.feePayer = userPubkey;
  tx.recentBlockhash = blockhash;
  tx.add(
    SystemProgram.transfer({
      fromPubkey: userPubkey,
      toPubkey: userPubkey,
      lamports: 1000,
    }),
  );

  tx.sign(keypair);

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return serialized.toString("base64");
}

/**
 * @notice Builds fresh user transaction for final Solana send.
 * @param kp User keypair.
 * @param blockhash Latest Solana blockhash.
 * @returns Unsigned Solana transaction.
 */
function buildFreshUserTx(kp: Keypair, blockhash: string): Transaction {
  const tx = new Transaction();
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = blockhash;
  tx.add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: kp.publicKey,
      lamports: 1000,
    }),
  );
  return tx;
}

/**
 * @notice Runs Solana custom tx example.
 */
async function main() {
  const connection = new Connection(SOL_RPC, "confirmed");

  // Build custom Solana transaction bytes that UGF will quote.
  const txBase64 = await buildQuotedTxBase64(connection);

  // Log in with EVM payer wallet before requesting quote.
  await client.auth.login(wallet);

  // Ask UGF for route pricing to sponsor this Solana custom transaction.
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

  save("1_quote.json", quote);

  // Pay quote on EVM payment chain using x402.
  await client.payment.x402.execute({
    quote,
    signer: wallet,
    token: "USDC",
  });

  // Wait for sponsorship, then build and send fresh user transaction on Solana.
  const result = await client.chains.sol.sponsorCustomTx(
    quote.digest,
    keypair,
    connection,
    buildFreshUserTx,
    {
      onTick: (status, attempt) => {},
    },
  );

  save("2_execution.json", result);
}

main().catch((err) => {
  console.error("Failed");
  console.error(err);
});
