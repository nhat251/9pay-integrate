import type { NinePayConfig } from "./types";
import { DEFAULT_BASE_URL } from "./constants";

/**
 * Validate and normalize a partial NinePayConfig.
 * Throws if required fields are missing — fail fast at init time.
 */
export function validateConfig(
  config: Partial<NinePayConfig>
): NinePayConfig {
  const { merchantKey, secretKey, checksumKey, returnUrl } = config;
  const errors: string[] = [];

  if (!merchantKey) errors.push("merchantKey is required");
  if (!secretKey) errors.push("secretKey is required");
  if (!checksumKey) errors.push("checksumKey is required");
  if (!returnUrl) errors.push("returnUrl is required");

  if (errors.length > 0) {
    throw new Error(
      `9pay-integrate configuration error:\n  - ${errors.join("\n  - ")}`
    );
  }

  return {
    merchantKey: merchantKey as string,
    secretKey: secretKey as string,
    checksumKey: checksumKey as string,
    baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    returnUrl: returnUrl as string,
  };
}

/**
 * Build NinePayConfig from any environment-like object.
 * Accepts Record<string, string | undefined> so it works with
 * process.env, Vercel env, or custom config loaders.
 */
export function configFromEnv(
  env: Record<string, string | undefined>
): NinePayConfig {
  return validateConfig({
    merchantKey: env.NINEPAY_MERCHANT_KEY,
    secretKey: env.NINEPAY_SECRET_KEY,
    checksumKey: env.NINEPAY_CHECKSUM_KEY,
    baseUrl: env.NINEPAY_BASE_URL,
    returnUrl: env.NINEPAY_RETURN_URL,
  });
}
