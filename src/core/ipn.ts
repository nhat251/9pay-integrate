import type { IpnRawPayload } from "./types";

function readField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Extract IPN payload from FormData.
 * 9Pay sends POST with result and checksum fields.
 */
export function extractIpnFromFormData(formData: FormData): IpnRawPayload {
  return {
    result: readField(formData.get("result")),
    checksum: readField(formData.get("checksum")),
  };
}

/**
 * Extract IPN payload from URL-encoded string body.
 * 9Pay may send application/x-www-form-urlencoded instead of FormData.
 * Parsed manually so base64 "+" characters survive (URLSearchParams
 * would decode them as spaces).
 */
export function extractIpnFromUrlEncoded(body: string): IpnRawPayload {
  const fields: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    try {
      fields[decodeURIComponent(pair.slice(0, separator))] = decodeURIComponent(
        pair.slice(separator + 1)
      );
    } catch {
      continue;
    }
  }
  return {
    result: fields.result ?? "",
    checksum: fields.checksum ?? "",
  };
}

/**
 * Decode an IPN `result` field from base64 → JSON without verifying
 * the checksum. The output is UNTRUSTED — use it only to preview
 * fields (e.g. `invoice_no`) for loading expected values before
 * calling `processIpn`, which performs the real verification.
 * Returns null when the payload is not decodable.
 */
export function decodeIpnResult(
  result: string
): Record<string, unknown> | null {
  if (!result) return null;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(result, "base64").toString("utf-8")
    );
    if (
      decoded === null ||
      typeof decoded !== "object" ||
      Array.isArray(decoded)
    ) {
      return null;
    }
    return decoded as Record<string, unknown>;
  } catch {
    return null;
  }
}
