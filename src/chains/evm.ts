import { ethers } from "ethers";
import type { HttpClient } from "../http.js";
import { Status, type PollOptions } from "../status.js";
import { UGFError, type StatusResponse } from "../types.js";

export class EvmChain {
  private readonly status: Status;
  private readonly http: HttpClient;

  /**
   * @notice Creates EVM chain helper.
   * @param http Shared SDK HTTP client.
   */
  constructor(http: HttpClient) {
    this.http = http;
    this.status = new Status(http);
  }

  /**
   * @notice Waits until EVM route completes.
   * @param digest UGF route digest.
   * @param opts Optional polling settings.
   * @returns Final route status.
   */
  async waitForCompletion(
    digest: string,
    opts?: PollOptions,
  ): Promise<StatusResponse> {
    return this.status.poll(digest, opts);
  }

  /**
   * @notice Waits for sponsorship, sends user tx, then confirms it to UGF.
   * @param digest UGF route digest.
   * @param signer EVM signer for destination tx.
   * @param buildTx Caller-owned tx builder.
   * @param opts Optional polling settings.
   * @returns User transaction hash.
   */
  async sponsorAndExecute(
    digest: string,
    signer: ethers.Signer,
    buildTx: (signer: ethers.Signer) => Promise<ethers.TransactionResponse>,
    opts?: PollOptions,
  ): Promise<{ userTxHash: string }> {
    const completed = await this.status.poll(digest, opts);

    const userTx = await buildTx(signer);

    await this.http.post("/evm/confirm", {
      digest,
      tx_hash: userTx.hash,
    });

    return {
      userTxHash: userTx.hash,
    };
  }
}
