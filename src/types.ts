// ─── Registry ────────────────────────────────────────────────────────────────

export interface ChainEntry {
  chain_id: string;
  chain_type: "evm" | "sol" | "sui" | "tron";
  address: string;
  vault_address?: string; // only for native tokens
}

export interface PaymentOption {
  token: string;               // "USDC" | "EURC" | "$U" | "ETH" | "BNB" | "MATIC" | "AVAX"
  type: "x402" | "native";
  chain_type: "evm" | "sol" | "sui" | "tron";
  receiver_address?: string;   // present for x402 tokens
  chains: ChainEntry[];
}

export interface RegistryResponse {
  payment_options: PaymentOption[];
  vault_abi: string;           // JSON string of the vault ABI
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface NonceResponse {
  nonce: string;
}

export interface LoginResponse {
  token: string;
}

// ─── Quote ───────────────────────────────────────────────────────────────────

export interface QuoteRequest {
  payment_coin: string;
  payer_address: string;
  payment_chain: string;
  payment_chain_type: "evm" | "sol" | "sui" | "tron";
  tx_object: string;           // JSON stringified tx
  dest_chain_id: string;
  dest_chain_type: "evm" | "sol" | "sui" | "tron";
}

export interface QuoteResponse {
  digest: string;
  payment_amount: string;
  payment_mode: "x402" | "vault";
  payment_to: string;
  gas_amount: string;
  expires_at: number;
  // chain-specific (optional)
  serialized_message?: string; // Solana
  tx_bytes?: string;           // SUI
  sponsor_sig?: string;        // SUI
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface X402Payload {
  digest: string;
  payment_mode: "x402";
  v: number;
  r: string;
  s: string;
  nonce: string;
  valid_after: number;
  valid_before: number;
}

export interface VaultPayload {
  digest: string;
  payment_mode: "vault";
  tx_hash: string;
}

export interface PaymentSubmitResponse {
  status: string;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export type TxStatus =
  | "pending"
  | "awaiting_user_sig"
  | "completed"
  | "failed"
  | "expired";

export interface StatusResponse {
  status: TxStatus;
  digest: string;
  signature?: string;
  serialized_message?: string;
  tx_bytes?: string;
  sponsor_sig?: string;
  error?: string;
}

// ─── Tron ────────────────────────────────────────────────────────────────────

export interface TronResources {
  bandwidthAvailable: number;
  energyAvailable: number;
}

export interface TronNetworkCosts {
  bandwidthCost: number;
  activationCost: number;
  minBandwidthRequired: number;
}

export interface TrxTransferTxObject {
  tron_address: string;
  transfer_type: "trx_transfer";
  to: string;
  amount: string;
}

export interface Trc20TransferTxObject {
  tron_address: string;
  transfer_type: "trc20_transfer";
  to: string;
  amount: string;
  contract: string;
}

export type TrxSponsorshipReason = "none" | "activation" | "bandwidth";

export interface TrxSponsorshipAssessment {
  requiresSponsorship: boolean;
  reason: TrxSponsorshipReason;
  needsActivation: boolean;
  hasEnoughBandwidth: boolean;
  resources: TronResources;
  networkCosts: TronNetworkCosts;
}

export type Trc20SponsorshipReason =
  | "none"
  | "bandwidth"
  | "energy"
  | "bandwidth_and_energy";

export interface Trc20SponsorshipAssessment {
  requiresSponsorship: boolean;
  reason: Trc20SponsorshipReason;
  hasEnoughBandwidth: boolean;
  hasEnoughEnergy: boolean;
  requiredBandwidth: number;
  requiredEnergy: number;
  resources: TronResources;
}

export interface TronSponsoredExecutionResult {
  txId: string;
  status: StatusResponse;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class UGFError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "UGFError";
  }
}

export class UGFAuthError extends UGFError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
    this.name = "UGFAuthError";
  }
}

export class UGFTimeoutError extends UGFError {
  constructor(message: string) {
    super(message, "TIMEOUT");
    this.name = "UGFTimeoutError";
  }
}

export class UGFSignatureError extends UGFError {
  constructor(message: string) {
    super(message, "SIGNATURE_ERROR");
    this.name = "UGFSignatureError";
  }
}

// ─── SDK Config ──────────────────────────────────────────────────────────────

export interface UGFClientConfig {
  baseUrl?: string;
  token?: string;
}
