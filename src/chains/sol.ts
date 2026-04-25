import type {
  Transaction,
  Connection,
  Keypair,
} from "@solana/web3.js";
import type { HttpClient } from "../http.js";
import { Status, type PollOptions } from "../status.js";
import { UGFError, UGFSignatureError, type StatusResponse } from "../types.js";

let _sol: typeof import("@solana/web3.js") | null = null;

/**
 * @notice Lazily loads Solana SDK.
 * @returns Solana module instance.
 */
async function loadSolana() {
  if (!_sol) _sol = await import("@solana/web3.js");
  return _sol;
}

export class SolChain {
  private readonly status: Status;

  /**
   * @notice Creates Solana chain helper.
   * @param http Shared SDK HTTP client.
   */
  constructor(private readonly http: HttpClient) {
    this.status = new Status(http);
  }

  /**
   * @notice Submits user Solana signature back to UGF.
   * @param digest UGF route digest.
   * @param userSig Base64 Solana user signature.
   */
  private async submitSig(digest: string, userSig: string): Promise<void> {
    await this.http.post("/sol/submit/sig", { digest, user_sig: userSig });
  }

  /**
   * @notice Signs sponsored SOL transfer message.
   * @param serializedMessage Base64 serialized Solana message.
   * @param keypair User signing keypair.
   * @returns Base64 user signature.
   */
  private async signSolTransfer(
    serializedMessage: string,
    keypair: Keypair,
  ): Promise<string> {
    const { VersionedMessage, VersionedTransaction, Transaction } =
      await loadSolana();

    const msgBuffer = Buffer.from(serializedMessage, "base64");
    try {
      const versionedMsg = VersionedMessage.deserialize(msgBuffer);
      const vTx = new VersionedTransaction(versionedMsg);
      vTx.sign([keypair]);
      // sponsor=0, user=1
      return Buffer.from(vTx.signatures[1]).toString("base64");
    } catch {
      const legacyTx = Transaction.from(msgBuffer);
      legacyTx.partialSign(keypair);
      const entry = legacyTx.signatures.find(
        (s) =>
          s.publicKey.toBase58() === keypair.publicKey.toBase58() &&
          s.signature !== null,
      );
      if (!entry?.signature)
        throw new UGFSignatureError(
          "User sig not found in legacy sol_transfer tx",
        );
      return entry.signature.toString("base64");
    }
  }

  /**
   * @notice Signs sponsored SPL transfer message.
   * @param serializedMessage Base64 serialized Solana message.
   * @param keypair User signing keypair.
   * @returns Base64 user signature.
   */
  private async signSplTransfer(
    serializedMessage: string,
    keypair: Keypair,
  ): Promise<string> {
    const { VersionedMessage, VersionedTransaction, Transaction } =
      await loadSolana();
    const msgBuffer = Buffer.from(serializedMessage, "base64");
    const userPubkey = keypair.publicKey.toBase58();
    try {
      const versionedMsg = VersionedMessage.deserialize(msgBuffer);
      const vTx = new VersionedTransaction(versionedMsg);
      vTx.sign([keypair]);
      const userIndex = versionedMsg.staticAccountKeys
        .slice(0, versionedMsg.header.numRequiredSignatures)
        .findIndex((pk) => pk.toBase58() === userPubkey);
      if (userIndex === -1)
        throw new UGFSignatureError("User pubkey not in signer list");
      return Buffer.from(vTx.signatures[userIndex]).toString("base64");
    } catch (err) {
      if (err instanceof UGFSignatureError) throw err;
      // @ts-ignore
      const legacyTx = Transaction.populate({
        ...Transaction.from(msgBuffer).compileMessage(),
      });
      legacyTx.partialSign(keypair);
      const entry = legacyTx.signatures.find(
        (s) => s.publicKey.toBase58() === userPubkey && s.signature !== null,
      );
      if (!entry?.signature)
        throw new UGFSignatureError(
          "User sig not found in legacy spl_transfer tx",
        );
      return entry.signature.toString("base64");
    }
  }

  /**
   * @notice Shared Solana user-signature flow.
   * @param digest UGF route digest.
   * @param keypair User signing keypair.
   * @param signFn Message signing helper.
   * @param opts Optional polling settings.
   * @returns Final route status.
   */
  private async executeFlow(
    digest: string,
    keypair: Keypair,
    signFn: (msg: string, kp: Keypair) => Promise<string>,
    opts?: PollOptions,
  ): Promise<StatusResponse> {
    const sigStatus = await this.status.waitForUserSig(digest, opts);
    if (!sigStatus.serialized_message) {
      throw new UGFError(
        "awaiting_user_sig but serialized_message missing",
        "MISSING_SERIALIZED_MESSAGE",
      );
    }
    const userSig = await signFn(sigStatus.serialized_message, keypair);
    await this.submitSig(digest, userSig);
    return this.status.poll(digest, opts);
  }

  /**
   * @notice Completes sponsored native SOL transfer flow.
   * @param digest UGF route digest.
   * @param keypair User signing keypair.
   * @param opts Optional polling settings.
   * @returns Final route status.
   */
  async sponsorSolTransfer(
    digest: string,
    keypair: Keypair,
    opts?: PollOptions,
  ): Promise<StatusResponse> {
    return this.executeFlow(
      digest,
      keypair,
      this.signSolTransfer.bind(this),
      opts,
    );
  }

  /**
   * @notice Completes sponsored SPL token transfer flow.
   * @param digest UGF route digest.
   * @param keypair User signing keypair.
   * @param opts Optional polling settings.
   * @returns Final route status.
   */
  async sponsorSplTransfer(
    digest: string,
    keypair: Keypair,
    opts?: PollOptions,
  ): Promise<StatusResponse> {
    return this.executeFlow(
      digest,
      keypair,
      this.signSplTransfer.bind(this),
      opts,
    );
  }

  /**
   * @notice Completes sponsored custom Solana tx flow.
   * @param digest UGF route digest.
   * @param keypair User signing keypair.
   * @param connection Solana RPC connection.
   * @param buildTx Caller-owned transaction builder.
   * @param opts Optional polling settings.
   * @returns UGF funding signature and user tx signature.
   */
  async sponsorCustomTx(
    digest: string,
    keypair: Keypair,
    connection: Connection,
    buildTx: (keypair: Keypair, blockhash: string) => Transaction,
    opts?: PollOptions,
  ): Promise<{ ugfSignature: string; userTxSignature: string }> {
    const completed = await this.status.poll(digest, opts);
    if (!completed.signature) {
      throw new UGFError(
        "completed but no UGF signature returned",
        "MISSING_SIGNATURE",
      );
    }

    const { blockhash } = await connection.getLatestBlockhash();
    const userTx = buildTx(keypair, blockhash);
    userTx.sign(keypair);

    const userTxSig = await connection.sendRawTransaction(userTx.serialize());
    await connection.confirmTransaction(userTxSig, "confirmed");

    return {
      ugfSignature: completed.signature,
      userTxSignature: userTxSig,
    };
  }
}
