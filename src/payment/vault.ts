import { ethers } from "ethers";
import type { HttpClient } from "../http.js";
import type { Registry } from "../registry.js";
import {
  UGFError,
  type PaymentSubmitResponse,
  type QuoteResponse,
  type VaultPayload,
} from "../types.js";

export class VaultPayment {
  /**
   * @notice Creates vault payment helper.
   * @param http Shared SDK HTTP client.
   * @param registry Registry helper for vault discovery.
   */
  constructor(
    private readonly http: HttpClient,
    private readonly registry: Registry,
  ) {}

  /**
   * @notice Pays quote through vault contract.
   * @param quote Quote returned by UGF.
   * @param signer EVM signer sending native payment.
   * @param chainId Payment chain id.
   * @param token Payment token symbol.
   * @returns Vault payment payload ready for submission.
   */
  async pay(
    quote: QuoteResponse,
    signer: ethers.Signer,
    chainId: string,
    token: string,
  ): Promise<VaultPayload> {
    // Resolve vault address + ABI from registry
    const entry = await this.registry.getChainEntry(token, chainId);
    if (!entry.vault_address) {
      throw new UGFError(
        `No vault address for token ${token} on chain ${chainId}`,
        "VAULT_NOT_FOUND",
      );
    }

    const vaultAbi = await this.registry.getVaultAbi();
    const vault = new ethers.Contract(entry.vault_address, vaultAbi, signer);

    const tx = await vault.payForFuel(quote.digest, {
      value: BigInt(quote.payment_amount),
    });

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new UGFError(`Vault tx failed. Hash: ${tx.hash}`, "VAULT_TX_FAILED");
    }

    return {
      digest: quote.digest,
      payment_mode: "vault",
      tx_hash: receipt.hash,
    };
  }

  /**
   * @notice Submits vault payment payload to UGF.
   * @param payload Vault payment payload.
   * @returns Gateway payment submission result.
   */
  async submit(payload: VaultPayload): Promise<PaymentSubmitResponse> {
    return this.http.post<PaymentSubmitResponse>("/payment/submit", payload);
  }

  /**
   * @notice Pays through vault and submits result in one step.
   * @param quote Quote returned by UGF.
   * @param signer EVM signer sending native payment.
   * @param chainId Payment chain id.
   * @param token Payment token symbol.
   * @returns Gateway payment submission result.
   */
  async payAndSubmit(
    quote: QuoteResponse,
    signer: ethers.Signer,
    chainId: string,
    token: string,
  ): Promise<PaymentSubmitResponse> {
    const payload = await this.pay(quote, signer, chainId, token);
    return this.submit(payload);
  }

  /**
   * @notice Builds unsigned vault payment tx. SDK never sees the private key.
   * @param quote Quote returned by UGF.
   * @param payerAddress Address that will sign and broadcast the tx locally.
   * @param chainId Payment chain id.
   * @param token Payment token symbol.
   * @param provider Read-only provider used for nonce + gas estimation.
   * @returns Unsigned tx object ready for local signing.
   */
  async buildPaymentTx(
    quote: QuoteResponse,
    payerAddress: string,
    chainId: string,
    token: string,
    provider: ethers.Provider,
  ): Promise<{
    to: string;
    data: string;
    value: bigint;
    chainId: bigint;
    gasLimit: bigint;
    nonce: number;
    type: number;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    // Resolve vault address + ABI from registry
    const entry = await this.registry.getChainEntry(token, chainId);
    if (!entry.vault_address) {
      throw new UGFError(
        `No vault address for token ${token} on chain ${chainId}`,
        "VAULT_NOT_FOUND",
      );
    }

    const vaultAbi = await this.registry.getVaultAbi();
    const vault = new ethers.Contract(entry.vault_address, vaultAbi, provider);

    const data = vault.interface.encodeFunctionData("payForFuel", [
      quote.digest,
    ]);
    const value = BigInt(quote.payment_amount);
    const to = entry.vault_address;

    const nonce = await provider.getTransactionCount(payerAddress, "pending");
    const gasLimit = await provider.estimateGas({
      to,
      from: payerAddress,
      data,
      value,
    });
    const network = await provider.getNetwork();
    const fee = await provider.getFeeData();
    if (!fee.maxFeePerGas || !fee.maxPriorityFeePerGas) {
      throw new UGFError(
        "Provider did not return EIP-1559 fee data",
        "FEE_DATA_MISSING",
      );
    }

    return {
      to,
      data,
      value,
      chainId: network.chainId,
      gasLimit,
      nonce,
      type: 2,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    };
  }

  /**
   * @notice Submits a vault payment the app already broadcast on-chain.
   * @param quote Quote returned by UGF.
   * @param txHash Hash of the user-broadcast payForFuel tx.
   * @returns Gateway payment submission result.
   */
  async submitSigned(
    quote: QuoteResponse,
    txHash: string,
  ): Promise<PaymentSubmitResponse> {
    const payload: VaultPayload = {
      digest: quote.digest,
      payment_mode: "vault",
      tx_hash: txHash,
    };
    return this.submit(payload);
  }
}
