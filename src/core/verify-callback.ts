import type { NinePayConfig, VerifyCallbackResult } from "./types";
import { NINEPAY_SUCCESS_STATUS } from "./transaction-status";
import { verifyChecksum } from "./verification";

/**
 * Verify 9Pay browser redirect callback.
 *
 * Takes URL search params (from GET /api/checkout/9pay/callback),
 * verifies the checksum, extracts orderId and payment info.
 *
 * Returns an object — consumer decides what to redirect to.
 * This is Option B: package does NOT redirect, only returns data.
 *
 * The browser redirect is display-only: a valid checksum does not mean
 * the order is paid. Only the server-to-server IPN settles orders —
 * send the user to a processing page that polls the order status.
 */
export function verifyCallback(
  searchParams: URLSearchParams,
  config: NinePayConfig
): VerifyCallbackResult {
  const result = searchParams.get("result") || "";
  const checksum = searchParams.get("checksum") || "";

  const verification = verifyChecksum(result, checksum, config.checksumKey);

  if (!verification.valid || !verification.data) {
    return {
      success: false,
      rawParams: {},
      error: verification.error || "Invalid callback payload",
      isSuccess: false,
    };
  }

  const paymentInfo = verification.data;
  const invoiceNo = paymentInfo.invoice_no;

  const orderId =
    typeof invoiceNo === "string" && invoiceNo.trim().length > 0
      ? invoiceNo.trim()
      : typeof invoiceNo === "number" && Number.isSafeInteger(invoiceNo)
        ? String(invoiceNo)
        : null;

  if (!orderId) {
    return {
      success: false,
      rawParams: paymentInfo,
      error: "Missing invoice_no in callback payload",
      isSuccess: false,
    };
  }

  const amount = readNumber(paymentInfo.amount);
  const status = readNumber(paymentInfo.status);
  if (amount === null || status === null) {
    return {
      success: false,
      rawParams: paymentInfo,
      error: "Malformed amount or status in callback payload",
      isSuccess: false,
    };
  }

  return {
    success: true,
    orderId,
    amount,
    currency: readCurrency(paymentInfo),
    status,
    isSuccess: status === NINEPAY_SUCCESS_STATUS,
    rawParams: paymentInfo,
  };
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readCurrency(paymentInfo: Record<string, unknown>): string {
  return typeof paymentInfo.currency === "string"
    ? paymentInfo.currency
    : "";
}
