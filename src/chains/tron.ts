import type { HttpClient } from "../http.js";
import { Status, type PollOptions } from "../status.js";
import {
  UGFError,
  type StatusResponse,
  type Trc20SponsorshipAssessment,
  type Trc20TransferTxObject,
  type TronNetworkCosts,
  type TronResources,
  type TronSponsoredExecutionResult,
  type TrxSponsorshipAssessment,
  type TrxTransferTxObject,
} from "../types.js";

interface TronAccountResponse {
  address?: string;
}

interface TronAccountNetResponse {
  freeNetLimit?: number;
  freeNetUsed?: number;
}

interface TronAccountResourceResponse {
  EnergyLimit?: number;
  EnergyUsed?: number;
}

interface TronChainParametersResponse {
  chainParameter?: Array<{
    key?: string;
    value?: number;
  }>;
}

export class TronChain {
  private readonly status: Status;

  /**
   * @notice Creates Tron chain helper bound to shared HTTP client.
   * @param http Shared SDK HTTP client used for UGF status polling.
   */
  constructor(private readonly http: HttpClient) {
    this.status = new Status(http);
  }

  /**
   * @notice Builds UGF `tx_object` payload for native TRX transfer quotes.
   * @param params Transfer input values.
   * @param params.tronAddress Sender Tron address.
   * @param params.to Recipient Tron address.
   * @param params.amount Transfer amount in sun.
   * @returns Quote-ready Tron TRX transfer object.
   */
  createTrxTransferTxObject(params: {
    tronAddress: string;
    to: string;
    amount: string;
  }): TrxTransferTxObject {
    return {
      tron_address: params.tronAddress,
      transfer_type: "trx_transfer",
      to: params.to,
      amount: params.amount,
    };
  }

  /**
   * @notice Builds UGF `tx_object` payload for TRC20 transfer quotes.
   * @param params Transfer input values.
   * @param params.tronAddress Sender Tron address.
   * @param params.to Recipient Tron address.
   * @param params.amount Raw token amount.
   * @param params.contract TRC20 contract address.
   * @returns Quote-ready Tron TRC20 transfer object.
   */
  createTrc20TransferTxObject(params: {
    tronAddress: string;
    to: string;
    amount: string;
    contract: string;
  }): Trc20TransferTxObject {
    return {
      tron_address: params.tronAddress,
      transfer_type: "trc20_transfer",
      to: params.to,
      amount: params.amount,
      contract: params.contract,
    };
  }

  /**
   * @notice Reads available Tron bandwidth and energy for address.
   * @param rpcUrl User-provided Tron RPC base URL.
   * @param address Tron address to inspect.
   * @returns Remaining free bandwidth and energy available to address.
   */
  async getResources(rpcUrl: string, address: string): Promise<TronResources> {
    const [netRes, energyRes] = await Promise.all([
      this.rpcPost<TronAccountNetResponse>(rpcUrl, "/wallet/getaccountnet", {
        address,
        visible: true,
      }),
      this.rpcPost<TronAccountResourceResponse>(
        rpcUrl,
        "/wallet/getaccountresource",
        {
          address,
          visible: true,
        },
      ),
    ]);

    const totalBandwidth = netRes.freeNetLimit ?? 1500;
    const usedBandwidth = netRes.freeNetUsed ?? 0;
    const totalEnergy = energyRes.EnergyLimit ?? 0;
    const usedEnergy = energyRes.EnergyUsed ?? 0;

    return {
      bandwidthAvailable: Math.max(totalBandwidth - usedBandwidth, 0),
      energyAvailable: Math.max(totalEnergy - usedEnergy, 0),
    };
  }

  /**
   * @notice Checks whether Tron account is not yet activated on-chain.
   * @param rpcUrl User-provided Tron RPC base URL.
   * @param address Tron address to inspect.
   * @returns `true` when account does not exist or has no activated state.
   */
  async isAccountUnactivated(
    rpcUrl: string,
    address: string,
  ): Promise<boolean> {
    const account = await this.rpcPost<TronAccountResponse>(
      rpcUrl,
      "/wallet/getaccount",
      {
        address,
        visible: true,
      },
    );

    return !account || !account.address || Object.keys(account).length === 0;
  }

  /**
   * @notice Reads network cost inputs used for TRX sponsorship checks.
   * @param rpcUrl User-provided Tron RPC base URL.
   * @returns Estimated bandwidth cost, activation cost, and minimum bandwidth target.
   */
  async getNetworkCosts(rpcUrl: string): Promise<TronNetworkCosts> {
    const data = await this.rpcPost<TronChainParametersResponse>(
      rpcUrl,
      "/wallet/getchainparameters",
      {},
    );

    const params = data.chainParameter ?? [];
    const getParam = (key: string): number | undefined =>
      params.find((param) => param.key === key)?.value;

    const bandwidthPrice = getParam("getTransactionFee");
    const createAccountFee = getParam("getCreateAccountFee");

    if (bandwidthPrice === undefined || createAccountFee === undefined) {
      throw new UGFError(
        "Tron RPC response missing chain parameters",
        "TRON_RPC_INVALID_RESPONSE",
      );
    }

    const avgTxSize = 268;

    return {
      bandwidthCost: (bandwidthPrice * avgTxSize) / 1e6,
      activationCost: createAccountFee / 1e6,
      minBandwidthRequired: avgTxSize,
    };
  }

  /**
   * @notice Decides whether native TRX transfer needs UGF sponsorship.
   * @param params TRX sponsorship assessment inputs.
   * @param params.rpcUrl User-provided Tron RPC base URL.
   * @param params.fromAddress Sender Tron address.
   * @param params.toAddress Recipient Tron address.
   * @returns Sponsorship decision with activation, bandwidth, and resource details.
   */
  async assessTrxTransfer(params: {
    rpcUrl: string;
    fromAddress: string;
    toAddress: string;
  }): Promise<TrxSponsorshipAssessment> {
    const { rpcUrl, fromAddress, toAddress } = params;

    const [resources, networkCosts, needsActivation] = await Promise.all([
      this.getResources(rpcUrl, fromAddress),
      this.getNetworkCosts(rpcUrl),
      this.isAccountUnactivated(rpcUrl, toAddress),
    ]);

    const hasEnoughBandwidth =
      resources.bandwidthAvailable >= networkCosts.minBandwidthRequired;

    if (needsActivation) {
      return {
        requiresSponsorship: true,
        reason: "activation",
        needsActivation,
        hasEnoughBandwidth,
        resources,
        networkCosts,
      };
    }

    if (!hasEnoughBandwidth) {
      return {
        requiresSponsorship: true,
        reason: "bandwidth",
        needsActivation,
        hasEnoughBandwidth,
        resources,
        networkCosts,
      };
    }

    return {
      requiresSponsorship: false,
      reason: "none",
      needsActivation,
      hasEnoughBandwidth,
      resources,
      networkCosts,
    };
  }

  /**
   * @notice Decides whether TRC20 transfer needs UGF sponsorship.
   * @param params TRC20 sponsorship assessment inputs.
   * @param params.rpcUrl User-provided Tron RPC base URL.
   * @param params.fromAddress Sender Tron address.
   * @param params.requiredEnergy Energy needed for intended transfer.
   * @param params.requiredBandwidth Bandwidth needed for intended transfer.
   * @returns Sponsorship decision with resource sufficiency details.
   */
  async assessTrc20Transfer(params: {
    rpcUrl: string;
    fromAddress: string;
    requiredEnergy: number;
    requiredBandwidth: number;
  }): Promise<Trc20SponsorshipAssessment> {
    const { rpcUrl, fromAddress, requiredEnergy, requiredBandwidth } = params;

    const resources = await this.getResources(rpcUrl, fromAddress);
    const hasEnoughEnergy = resources.energyAvailable >= requiredEnergy;
    const hasEnoughBandwidth = resources.bandwidthAvailable >= requiredBandwidth;

    if (hasEnoughEnergy && hasEnoughBandwidth) {
      return {
        requiresSponsorship: false,
        reason: "none",
        hasEnoughBandwidth,
        hasEnoughEnergy,
        requiredBandwidth,
        requiredEnergy,
        resources,
      };
    }

    if (hasEnoughEnergy) {
      return {
        requiresSponsorship: true,
        reason: "bandwidth",
        hasEnoughBandwidth,
        hasEnoughEnergy,
        requiredBandwidth,
        requiredEnergy,
        resources,
      };
    }

    if (hasEnoughBandwidth) {
      return {
        requiresSponsorship: true,
        reason: "energy",
        hasEnoughBandwidth,
        hasEnoughEnergy,
        requiredBandwidth,
        requiredEnergy,
        resources,
      };
    }

    return {
      requiresSponsorship: true,
      reason: "bandwidth_and_energy",
      hasEnoughBandwidth,
      hasEnoughEnergy,
      requiredBandwidth,
      requiredEnergy,
      resources,
    };
  }

  /**
   * @notice Polls UGF status until Tron sponsorship route reaches terminal state.
   * @param digest Quote digest returned by UGF.
   * @param opts Optional polling overrides.
   * @returns Final UGF route status payload.
   */
  async waitForCompletion(
    digest: string,
    opts?: PollOptions,
  ): Promise<StatusResponse> {
    return this.status.poll(digest, opts);
  }

  /**
   * @notice Waits for TRX sponsorship completion, then calls caller broadcast fn.
   * @param params Broadcast flow inputs.
   * @param params.digest Quote digest returned by UGF.
   * @param params.sendTx Caller-owned fn that signs and broadcasts final Tron tx.
   * @param params.opts Optional polling overrides.
   * @returns Broadcast tx id plus terminal UGF status.
   */
  async sponsorAndBroadcastTrx(params: {
    digest: string;
    sendTx: () => Promise<string>;
    opts?: PollOptions;
  }): Promise<TronSponsoredExecutionResult> {
    return this.sponsorAndBroadcast(params);
  }

  /**
   * @notice Waits for TRC20 sponsorship completion, then calls caller broadcast fn.
   * @param params Broadcast flow inputs.
   * @param params.digest Quote digest returned by UGF.
   * @param params.sendTx Caller-owned fn that signs and broadcasts final Tron tx.
   * @param params.opts Optional polling overrides.
   * @returns Broadcast tx id plus terminal UGF status.
   */
  async sponsorAndBroadcastTrc20(params: {
    digest: string;
    sendTx: () => Promise<string>;
    opts?: PollOptions;
  }): Promise<TronSponsoredExecutionResult> {
    return this.sponsorAndBroadcast(params);
  }

  /**
   * @notice Shared helper for Tron sponsorship wait-then-broadcast flow.
   * @param params Broadcast flow inputs.
   * @param params.digest Quote digest returned by UGF.
   * @param params.sendTx Caller-owned fn that signs and broadcasts final Tron tx.
   * @param params.opts Optional polling overrides.
   * @returns Broadcast tx id plus terminal UGF status.
   */
  private async sponsorAndBroadcast(params: {
    digest: string;
    sendTx: () => Promise<string>;
    opts?: PollOptions;
  }): Promise<TronSponsoredExecutionResult> {
    const status = await this.status.poll(params.digest, params.opts);
    const txId = await params.sendTx();

    if (!txId) {
      throw new UGFError("Tron sendTx returned empty txId", "MISSING_TX_ID");
    }

    return { txId, status };
  }

  /**
   * @notice Sends JSON-RPC style POST request to Tron HTTP endpoint.
   * @param rpcUrl User-provided Tron RPC base URL.
   * @param path Tron RPC path.
   * @param body Request payload.
   * @returns Parsed Tron RPC response body.
   */
  private async rpcPost<T>(
    rpcUrl: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    const baseUrl = rpcUrl.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new UGFError(
        `Tron RPC request failed: ${path}`,
        "TRON_RPC_ERROR",
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }
}
