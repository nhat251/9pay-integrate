/**
 * 9Pay status codes and defaults.
 */

export const NINEPAY_STATUS = {
  PENDING: 1,
  PROCESSING: 2,
  CANCELLED: 3,
  REFUNDED: 4,
  SUCCESS: 5,
  FAILED: 6,
} as const;

/** Status code indicating successful payment */
export const SUCCESS_STATUS = NINEPAY_STATUS.SUCCESS;

/** Default 9Pay base URL */
export const DEFAULT_BASE_URL = "https://payment.9pay.vn";
