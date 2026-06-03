// ─── Core SDK — always available, zero framework dependencies ───────────────

// Config
export { validateConfig, configFromEnv } from "./core/config";

// Payment URL creation
export { createPaymentUrl } from "./core/payment-url";

// Signing primitives (for advanced/custom use cases)
export { buildHttpQuery, buildSignature } from "./core/signing";

// Checksum verification
export { verifyChecksum } from "./core/verification";

// Callback verification
export { verifyCallback } from "./core/verify-callback";

// IPN extraction (pure, adapter-agnostic)
export {
  extractIpnFromFormData,
  extractIpnFromUrlEncoded,
} from "./core/ipn";

// IPN processor (adapter-agnostic — the core of the package)
export { processIpn } from "./core/ipn-processor";

// Constants
export { NINEPAY_STATUS, SUCCESS_STATUS, DEFAULT_BASE_URL } from "./core/constants";

// ─── Types ──────────────────────────────────────────────────────────────────

export type {
  NinePayConfig,
  NinePayPaymentOptions,
  CreatePaymentParams,
  VerifyCallbackResult,
  VerificationResult,
  OrderStatus,
  OrderRepository,
  CreateOrderParams,
  NotificationContext,
  NotificationHandler,
  NotificationHooks,
  IpnRawPayload,
  IpnProcessResult,
  IpnProcessorOptions,
  PaymentStatusResponse,
} from "./core/types";
