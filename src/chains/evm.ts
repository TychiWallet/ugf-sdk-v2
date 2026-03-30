import { ethers } from "ethers";
import type { HttpClient } from "../http.js";
import { Status, type PollOptions } from "../status.js";
import { UGFError, type StatusResponse } from "../types.js";

export class EvmChain {
  private readonly status: Status;
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
    this.status = new Status(http);
  }

  async waitForCompletion(digest: string, opts?: PollOptions): Promise<StatusResponse> {
    return this.status.poll(digest, opts);
  }

  async sponsorAndExecute(
    digest: string,
    signer: ethers.Signer,
    buildTx: (signer: ethers.Signer) => Promise<ethers.TransactionResponse>,
    opts?: PollOptions,
  ): Promise<{ ugfSponsorTx: string; userTxHash: string }> {
    const completed = await this.status.poll(digest, opts);

    if (!completed.signature) {
      throw new UGFError("completed but no sponsor_tx returned", "MISSING_SIGNATURE");
    }

    const userTx = await buildTx(signer);
    const receipt = await userTx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new UGFError(`user tx failed: ${userTx.hash}`, "USER_TX_FAILED");
    }

    await this.http.post("/evm/confirm", {
      digest,
      tx_hash: receipt.hash,
    });

    return {
      ugfSponsorTx: completed.signature,
      userTxHash: receipt.hash,
    };
  }
}