// ─── Core SDK — always available, zero framework dependencies ───────────────

// Config
export { validateConfig, configFromEnv } from "./core/config";

// Payment URL creation
export { createPaymentUrl } from "./core/payment-url";

// Signing primitives (for advanced/custom use cases)
export {
  buildHttpQuery,
  buildSignature,
  buildPostSignature,
  buildGetSignature,
  buildAuthorizationHeaders,
} from "./core/signing";

// Checksum verification
export { verifyChecksum } from "./core/verification";

// Recurring (CIT/MIT) API client — framework-agnostic
export {
  NinePayRecurringClient,
  NinePayGatewayError,
  NINEPAY_RECURRING_PATH,
  NINEPAY_REQUEST_TIMEOUT_MS,
} from "./core/recurring-client";

// Result classification (MIT charge + inquiry)
export {
  classifyNinePayMitResult,
  classifyNinePayInquiry,
  isKnownNinePayMitErrorCode,
} from "./core/classify";
export type {
  NinePayMitOutcome,
  NinePayInquiryOutcome,
} from "./core/classify";

// Return URL builder (embeds payment intent id)
export { buildReturnUrl } from "./core/return-url";

// Callback verification
export { verifyCallback } from "./core/verify-callback";

// IPN extraction (pure, adapter-agnostic)
export {
  extractIpnFromFormData,
  extractIpnFromUrlEncoded,
  decodeIpnResult,
} from "./core/ipn";

// IPN processor (adapter-agnostic — the core of the package)
export { processIpn } from "./core/ipn-processor";

// Constants
export { NINEPAY_STATUS, SUCCESS_STATUS, DEFAULT_BASE_URL } from "./core/constants";

// Transaction statuses + error codes (portal + recurring)
export {
  NINEPAY_SUCCESS_STATUS,
  NINEPAY_FAILED_STATUS,
  NINEPAY_CANCELLED_STATUS,
  NINEPAY_RISK_REJECTED_STATUS,
  NINEPAY_INQUIRY_PENDING_STATUSES,
  NINEPAY_INQUIRY_FAILED_STATUSES,
  NINEPAY_PROCESSING_ERROR_CODE,
  NINEPAY_GATEWAY_NOT_CONFIGURED_ERROR_CODE,
  MANUAL_REVIEW_FAILURE_CODE,
  NINEPAY_MANUAL_REVIEW_STATUSES,
  NINEPAY_SUCCESS_ERROR_CODE,
  NINEPAY_ORDER_NOT_FOUND_ERROR_CODE,
  NINEPAY_REUSABLE_ORDER_STATUSES,
  NINEPAY_DEAD_ORDER_STATUSES,
} from "./core/transaction-status";

// MIT charge error-code taxonomy
export {
  NINEPAY_MIT_PENDING_ERROR_CODES,
  NINEPAY_MIT_DUPLICATE_ERROR_CODE,
  NINEPAY_MIT_RETRYABLE_ERROR_CODES,
  NINEPAY_MIT_MERCHANT_ERROR_CODES,
  NINEPAY_MIT_CARD_INVALID_ERROR_CODES,
  NINEPAY_MIT_MANUAL_REVIEW_ERROR_CODES,
  NINEPAY_TOKEN_INVALID_ERROR_CODE,
  NINEPAY_TOKEN_INVALID_REASON_FRAGMENT,
} from "./core/mit-error-codes";

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
  ManualReviewContext,
  NotificationHandler,
  NotificationHooks,
  IpnRawPayload,
  IpnProcessResult,
  IpnProcessorLogger,
  IpnProcessorOptions,
  PaymentStatusResponse,
} from "./core/types";

export type {
  NinePayRecurringClientConfig,
  NinePayCitRequest,
  NinePayCitResult,
  NinePayMitRequest,
  NinePayMitResult,
  NinePayInquiryResult,
} from "./core/recurring-client";
