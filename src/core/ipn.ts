import type { IpnRawPayload } from "./types";

/**
 * Extract IPN payload from FormData.
 * 9Pay sends POST with result and checksum fields.
 */
export function extractIpnFromFormData(
  formData: FormData
): IpnRawPayload {
  return {
    result: String(formData.get("result") || ""),
    checksum: String(formData.get("checksum") || ""),
  };
}

/**
 * Extract IPN payload from URL-encoded string body.
 * 9Pay may send application/x-www-form-urlencoded instead of FormData.
 */
export function extractIpnFromUrlEncoded(body: string): IpnRawPayload {
  const params = new URLSearchParams(body);
  return {
    result: params.get("result") || "",
    checksum: params.get("checksum") || "",
  };
}
