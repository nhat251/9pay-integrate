import * as crypto from "crypto";

/**
 * Build sorted HTTP query string from key-value pairs.
 * Keys are sorted alphabetically — required by 9Pay for valid signatures.
 */
export function buildHttpQuery(
  data: Record<string, string | number>
): string {
  const params = new URLSearchParams();
  const sortedKeys = Object.keys(data).sort();
  for (const key of sortedKeys) {
    if (data[key] !== undefined && data[key] !== null) {
      params.append(key, String(data[key]));
    }
  }
  return params.toString();
}

/**
 * Build HMAC-SHA256 signature for 9Pay payment creation request.
 * Message format: POST\n{baseUrl}/payments/create\n{time}\n{httpQuery}
 * Returns Base64-encoded signature.
 */
export function buildSignature(
  baseUrl: string,
  time: number,
  httpQuery: string,
  secretKey: string
): string {
  const message = `POST\n${baseUrl}/payments/create\n${time}\n${httpQuery}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest()
    .toString("base64");
}
