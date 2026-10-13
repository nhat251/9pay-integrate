/**
 * Legacy 9Pay status codes.
 *
 * @deprecated These early values do not match production 9Pay behavior
 * (cancelled orders report status 8, not 3). Use the `transaction-status`
 * module instead: NINEPAY_SUCCESS_STATUS, NINEPAY_FAILED_STATUS,
 * NINEPAY_CANCELLED_STATUS, NINEPAY_RISK_REJECTED_STATUS.
 */
export const NINEPAY_STATUS = {
  SUCCESS: 5,
  FAILED: 6,
  CANCELLED: 8,
  RISK_REJECTED: 9,
} as const;

/** Status code indicating successful payment */
export const SUCCESS_STATUS = NINEPAY_STATUS.SUCCESS;

/** Default 9Pay base URL */
export const DEFAULT_BASE_URL = "https://payment.9pay.vn";
