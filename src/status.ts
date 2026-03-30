import type { HttpClient } from "./http.js";
import { UGFError, UGFTimeoutError, type StatusResponse, type TxStatus } from "./types.js";

export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onTick?: (status: StatusResponse, attempt: number) => void;
}

export class Status {
  constructor(private readonly http: HttpClient) {}

  async get(digest: string): Promise<StatusResponse> {
    return this.http.get<StatusResponse>(`/status?digest=${digest}`);
  }

  async poll(digest: string, opts: PollOptions = {}): Promise<StatusResponse> {
    const { maxAttempts = 35, intervalMs = 3000, onTick } = opts;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(intervalMs);
      const status = await this.get(digest);
      onTick?.(status, i + 1);

      if (status.status === "failed") {
        throw new UGFError(`Transaction failed: ${status.error ?? "unknown"}`, "TX_FAILED");
      }
      if (status.status === "expired") {
        throw new UGFError("Transaction expired", "TX_EXPIRED");
      }
      if (status.status === "completed") {
        return status;
      }
    }

    throw new UGFTimeoutError(`Polling timed out after ${maxAttempts} attempts for digest: ${digest}`);
  }

  /** Poll until awaiting_user_sig — Solana + SUI flows */
  async waitForUserSig(digest: string, opts: PollOptions = {}): Promise<StatusResponse> {
    const { maxAttempts = 30, intervalMs = 3000, onTick } = opts;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(intervalMs);
      const status = await this.get(digest);
      onTick?.(status, i + 1);

      if (status.status === "failed") {
        throw new UGFError(`Transaction failed: ${status.error ?? "unknown"}`, "TX_FAILED");
      }
      if (status.status === "expired") {
        throw new UGFError("Transaction expired", "TX_EXPIRED");
      }
      if (status.status === "awaiting_user_sig") {
        return status;
      }
    }

    throw new UGFTimeoutError(`Timed out waiting for user sig for digest: ${digest}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}