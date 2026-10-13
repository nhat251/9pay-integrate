import { describe, it, expect } from "vitest";
import {
  classifyNinePayInquiry,
  classifyNinePayMitResult,
  isKnownNinePayMitErrorCode,
} from "../src/core/classify";

describe("classifyNinePayMitResult", () => {
  it("maps 000 to SUCCEEDED", () => {
    expect(
      classifyNinePayMitResult({ errorCode: "000", failureReason: null })
    ).toBe("SUCCEEDED");
  });

  it("maps pending codes to PENDING", () => {
    for (const code of ["999", "412", "323", "337", "221"]) {
      expect(classifyNinePayMitResult({ errorCode: code, failureReason: null })).toBe(
        "PENDING"
      );
    }
  });

  it("maps 611 to DUPLICATE", () => {
    expect(
      classifyNinePayMitResult({ errorCode: "611", failureReason: null })
    ).toBe("DUPLICATE");
  });

  it("maps token-invalid with card reason to CARD_INVALID", () => {
    expect(
      classifyNinePayMitResult({
        errorCode: "666",
        failureReason: "Card or token invalid",
      })
    ).toBe("CARD_INVALID");
  });

  it("maps token-invalid without card reason to MERCHANT_ERROR", () => {
    expect(
      classifyNinePayMitResult({
        errorCode: "666",
        failureReason: "Merchant misconfiguration",
      })
    ).toBe("MERCHANT_ERROR");
  });

  it("maps merchant codes to MERCHANT_ERROR", () => {
    expect(
      classifyNinePayMitResult({ errorCode: "302", failureReason: null })
    ).toBe("MERCHANT_ERROR");
  });

  it("maps card codes to CARD_INVALID", () => {
    expect(
      classifyNinePayMitResult({ errorCode: "200", failureReason: null })
    ).toBe("CARD_INVALID");
  });

  it("maps manual-review codes to MANUAL_REVIEW", () => {
    for (const code of ["408", "615"]) {
      expect(classifyNinePayMitResult({ errorCode: code, failureReason: null })).toBe(
        "MANUAL_REVIEW"
      );
    }
  });

  it("falls back to RETRYABLE for unknown codes", () => {
    expect(
      classifyNinePayMitResult({ errorCode: "777", failureReason: null })
    ).toBe("RETRYABLE");
  });
});

describe("isKnownNinePayMitErrorCode", () => {
  it("accepts documented codes", () => {
    for (const code of ["000", "611", "666", "999", "210", "302", "200", "408"]) {
      expect(isKnownNinePayMitErrorCode(code)).toBe(true);
    }
  });

  it("rejects unknown codes", () => {
    expect(isKnownNinePayMitErrorCode("777")).toBe(false);
  });
});

describe("classifyNinePayInquiry", () => {
  it("maps status 5 + 000 to PAID", () => {
    expect(
      classifyNinePayInquiry({
        httpOk: true,
        status: 5,
        errorCode: "000",
        failureReason: null,
      })
    ).toEqual({ kind: "PAID" });
  });

  it("maps 221 to NOT_FOUND even on HTTP error", () => {
    expect(
      classifyNinePayInquiry({
        httpOk: false,
        status: 6,
        errorCode: "221",
        failureReason: "Transaction not found",
      })
    ).toEqual({ kind: "NOT_FOUND" });
  });

  it("maps pending statuses and 999 to PENDING", () => {
    expect(
      classifyNinePayInquiry({
        httpOk: true,
        status: 2,
        errorCode: "999",
        failureReason: null,
      })
    ).toEqual({ kind: "PENDING" });
    expect(
      classifyNinePayInquiry({
        httpOk: true,
        status: 3,
        errorCode: "001",
        failureReason: null,
      })
    ).toEqual({ kind: "PENDING" });
  });

  it("maps failed statuses to FAILED", () => {
    for (const status of [6, 8, 9]) {
      expect(
        classifyNinePayInquiry({
          httpOk: true,
          status,
          errorCode: "100",
          failureReason: "Declined",
        })
      ).toEqual({ kind: "FAILED", errorCode: "100", failureReason: "Declined" });
    }
  });

  it("defaults to PENDING for unrecognized input", () => {
    expect(
      classifyNinePayInquiry({
        httpOk: true,
        status: null,
        errorCode: "001",
        failureReason: null,
      })
    ).toEqual({ kind: "PENDING" });
  });
});
