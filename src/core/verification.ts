import * as crypto from "node:crypto";
import type { VerificationResult } from "./types";

function checksumEquals(normalized: string, expected: string): boolean {
  if (normalized.length !== expected.length) return false;
  if (typeof crypto.timingSafeEqual === "function") {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(normalized),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  }
  return normalized === expected;
}

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
  if (!result || !checksum || !checksumKey) {
    return { valid: false, data: null, error: "Missing result or checksum" };
  }

  const normalized = checksum.trim().toUpperCase();
  const expected = crypto
    .createHash("sha256")
    .update(result + checksumKey)
    .digest("hex")
    .toUpperCase();

  if (!checksumEquals(normalized, expected)) {
    return { valid: false, data: null, error: "Checksum mismatch" };
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(result, "base64").toString("utf-8")
    );
    if (
      decoded === null ||
      typeof decoded !== "object" ||
      Array.isArray(decoded)
    ) {
      return { valid: false, data: null, error: "Failed to decode result" };
    }
    return { valid: true, data: decoded as Record<string, unknown> };
  } catch {
    return { valid: false, data: null, error: "Failed to decode result" };
  }
}
