import * as crypto from "crypto";
import type { VerificationResult } from "./types";

/**
 * Verify 9Pay callback/IPN checksum.
 *
 * 9Pay computes: SHA256(result + checksumKey).toUpperCase()
 * We recompute and compare. If valid, decode result from base64 → JSON.
 *
 * @param result Base64-encoded JSON payload from 9Pay
 * @param checksum SHA256 hex hash from 9Pay
 * @param checksumKey Shared secret key
 */
export function verifyChecksum(
  result: string,
  checksum: string,
  checksumKey: string
): VerificationResult {
  if (!result || !checksum) {
    return { valid: false, data: null, error: "Missing result or checksum" };
  }

  const expected = crypto
    .createHash("sha256")
    .update(result + checksumKey)
    .digest("hex")
    .toUpperCase();

  if (expected !== checksum) {
    return { valid: false, data: null, error: "Checksum mismatch" };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(result, "base64").toString("utf-8")
    );
    return { valid: true, data: decoded as Record<string, unknown> };
  } catch {
    return { valid: false, data: null, error: "Failed to decode result" };
  }
}
