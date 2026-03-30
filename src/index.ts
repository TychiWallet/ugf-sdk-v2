export { UGFClient } from "./client.js";
export type { UGFClientConfig } from "./types.js";

// errors
export {
  UGFError,
  UGFAuthError,
  UGFTimeoutError,
  UGFSignatureError,
} from "./types.js";

// types
export type {
  // registry
  RegistryResponse,
  PaymentOption,
  ChainEntry,
  // auth
  NonceResponse,
  LoginResponse,
  // quote
  QuoteRequest,
  QuoteResponse,
  // payment
  X402Payload,
  VaultPayload,
  PaymentSubmitResponse,
  // status
  StatusResponse,
  TxStatus,
} from "./types.js";

// poll options
export type { PollOptions } from "./status.js";

// payment options
export type { X402Options } from "./payment/x402.js";