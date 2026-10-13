import {
  NINEPAY_MIT_CARD_INVALID_ERROR_CODES,
  NINEPAY_MIT_DUPLICATE_ERROR_CODE,
  NINEPAY_MIT_MANUAL_REVIEW_ERROR_CODES,
  NINEPAY_MIT_MERCHANT_ERROR_CODES,
  NINEPAY_MIT_PENDING_ERROR_CODES,
  NINEPAY_MIT_RETRYABLE_ERROR_CODES,
  NINEPAY_TOKEN_INVALID_ERROR_CODE,
  NINEPAY_TOKEN_INVALID_REASON_FRAGMENT,
} from "./mit-error-codes";
import {
  NINEPAY_INQUIRY_FAILED_STATUSES,
  NINEPAY_INQUIRY_PENDING_STATUSES,
  NINEPAY_ORDER_NOT_FOUND_ERROR_CODE,
  NINEPAY_PROCESSING_ERROR_CODE,
  NINEPAY_SUCCESS_ERROR_CODE,
  NINEPAY_SUCCESS_STATUS,
} from "./transaction-status";

export type NinePayMitOutcome =
  | "SUCCEEDED"
  | "PENDING"
  | "DUPLICATE"
  | "RETRYABLE"
  | "MERCHANT_ERROR"
  | "CARD_INVALID"
  | "MANUAL_REVIEW";

export type NinePayInquiryOutcome =
  | { kind: "PAID" }
  | { kind: "NOT_FOUND" }
  | { kind: "PENDING" }
  | { kind: "FAILED"; errorCode: string; failureReason: string | null };

const includes = (codes: readonly string[], errorCode: string): boolean =>
  codes.includes(errorCode);

export function classifyNinePayMitResult(input: {
  errorCode: string;
  failureReason: string | null;
}): NinePayMitOutcome {
  if (input.errorCode === NINEPAY_SUCCESS_ERROR_CODE) return "SUCCEEDED";
  if (includes(NINEPAY_MIT_PENDING_ERROR_CODES, input.errorCode))
    return "PENDING";
  if (input.errorCode === NINEPAY_MIT_DUPLICATE_ERROR_CODE) return "DUPLICATE";
  if (input.errorCode === NINEPAY_TOKEN_INVALID_ERROR_CODE) {
    const reason = input.failureReason?.toLowerCase() ?? "";
    return reason.includes(NINEPAY_TOKEN_INVALID_REASON_FRAGMENT)
      ? "CARD_INVALID"
      : "MERCHANT_ERROR";
  }
  if (includes(NINEPAY_MIT_MERCHANT_ERROR_CODES, input.errorCode))
    return "MERCHANT_ERROR";
  if (includes(NINEPAY_MIT_CARD_INVALID_ERROR_CODES, input.errorCode))
    return "CARD_INVALID";
  if (includes(NINEPAY_MIT_MANUAL_REVIEW_ERROR_CODES, input.errorCode))
    return "MANUAL_REVIEW";
  return "RETRYABLE";
}

export function isKnownNinePayMitErrorCode(errorCode: string): boolean {
  return (
    errorCode === NINEPAY_SUCCESS_ERROR_CODE ||
    errorCode === NINEPAY_MIT_DUPLICATE_ERROR_CODE ||
    errorCode === NINEPAY_TOKEN_INVALID_ERROR_CODE ||
    includes(NINEPAY_MIT_PENDING_ERROR_CODES, errorCode) ||
    includes(NINEPAY_MIT_RETRYABLE_ERROR_CODES, errorCode) ||
    includes(NINEPAY_MIT_MERCHANT_ERROR_CODES, errorCode) ||
    includes(NINEPAY_MIT_CARD_INVALID_ERROR_CODES, errorCode) ||
    includes(NINEPAY_MIT_MANUAL_REVIEW_ERROR_CODES, errorCode)
  );
}

export function classifyNinePayInquiry(input: {
  httpOk: boolean;
  status: number | null;
  errorCode: string;
  failureReason: string | null;
}): NinePayInquiryOutcome {
  if (input.errorCode === NINEPAY_ORDER_NOT_FOUND_ERROR_CODE)
    return { kind: "NOT_FOUND" };
  if (
    input.status === NINEPAY_SUCCESS_STATUS &&
    input.errorCode === NINEPAY_SUCCESS_ERROR_CODE
  )
    return { kind: "PAID" };
  if (
    (input.status !== null &&
      NINEPAY_INQUIRY_PENDING_STATUSES.includes(input.status)) ||
    input.errorCode === NINEPAY_PROCESSING_ERROR_CODE
  )
    return { kind: "PENDING" };
  if (
    input.status !== null &&
    NINEPAY_INQUIRY_FAILED_STATUSES.includes(input.status)
  )
    return {
      kind: "FAILED",
      errorCode: input.errorCode,
      failureReason: input.failureReason,
    };
  return { kind: "PENDING" };
}
