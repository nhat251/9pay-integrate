import * as crypto from "node:crypto";

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
  return buildPostSignature(
    baseUrl,
    "/payments/create",
    time,
    httpQuery,
    secretKey
  );
}

/**
 * Build HMAC-SHA256 signature for a generic 9Pay POST request.
 * Message format: POST\n{baseUrl}{path}\n{time}\n{canonical}
 * When canonical is empty the trailing newline segment is omitted.
 * Returns Base64-encoded signature.
 */
export function buildPostSignature(
  baseUrl: string,
  path: string,
  time: number,
  canonical: string,
  secretKey: string
): string {
  const message =
    canonical.length > 0
      ? `POST\n${baseUrl}${path}\n${time}\n${canonical}`
      : `POST\n${baseUrl}${path}\n${time}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

/**
 * Build HMAC-SHA256 signature for a generic 9Pay GET request.
 * Message format: GET\n{baseUrl}{path}\n{time}
 * Returns Base64-encoded signature.
 */
export function buildGetSignature(
  baseUrl: string,
  path: string,
  time: number,
  secretKey: string
): string {
  const message = `GET\n${baseUrl}${path}\n${time}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

/**
 * Build the Date + Authorization headers 9Pay expects for
 * recurring (CIT/MIT/inquire) API calls.
 */
export function buildAuthorizationHeaders(
  message: string,
  time: number,
  merchantKey: string,
  secretKey: string
): Record<string, string> {
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");
  return {
    Date: String(time),
    Authorization: `Signature Algorithm=HS256,Credential=${merchantKey},SignedHeaders=,Signature=${signature}`,
  };
}
