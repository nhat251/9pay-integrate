import type { NinePayConfig, VerifyCallbackResult } from "./types";
import { verifyChecksum } from "./verification";

/**
 * Verify 9Pay browser redirect callback.
 *
 * Takes URL search params (from GET /api/checkout/9pay/callback),
 * verifies the checksum, extracts orderId and payment info.
 *
 * Returns an object — consumer decides what to redirect to.
 * This is Option B: package does NOT redirect, only returns data.
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
    };
  }

  const paymentInfo = verification.data;
  const invoiceNo = paymentInfo.invoice_no;

  const orderId =
    typeof invoiceNo === "string" && invoiceNo.trim().length > 0
      ? invoiceNo
      : typeof invoiceNo === "number"
        ? String(invoiceNo)
        : null;

  if (!orderId) {
    return {
      success: false,
      rawParams: paymentInfo,
      error: "Missing invoice_no in callback payload",
    };
  }

  return {
    success: true,
    orderId,
    amount: Number(paymentInfo.amount ?? 0),
    currency: String(paymentInfo.currency ?? ""),
    status: Number(paymentInfo.status ?? 0),
    rawParams: paymentInfo,
  };
}
