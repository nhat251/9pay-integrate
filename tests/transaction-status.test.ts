import { describe, it, expect } from "vitest";
import {
  MANUAL_REVIEW_FAILURE_CODE,
  NINEPAY_CANCELLED_STATUS,
  NINEPAY_DEAD_ORDER_STATUSES,
  NINEPAY_FAILED_STATUS,
  NINEPAY_INQUIRY_FAILED_STATUSES,
  NINEPAY_INQUIRY_PENDING_STATUSES,
  NINEPAY_MANUAL_REVIEW_STATUSES,
  NINEPAY_ORDER_NOT_FOUND_ERROR_CODE,
  NINEPAY_PROCESSING_ERROR_CODE,
  NINEPAY_REUSABLE_ORDER_STATUSES,
  NINEPAY_SUCCESS_ERROR_CODE,
  NINEPAY_SUCCESS_STATUS,
} from "../src/core/transaction-status";
import {
  NINEPAY_MIT_DUPLICATE_ERROR_CODE,
  NINEPAY_TOKEN_INVALID_ERROR_CODE,
} from "../src/core/mit-error-codes";
import { NINEPAY_STATUS, SUCCESS_STATUS } from "../src/core/constants";

describe("transaction status ground truth", () => {
  it("pins production status codes", () => {
    expect(NINEPAY_SUCCESS_STATUS).toBe(5);
    expect(NINEPAY_FAILED_STATUS).toBe(6);
    expect(NINEPAY_CANCELLED_STATUS).toBe(8);
    expect(NINEPAY_INQUIRY_PENDING_STATUSES).toEqual([2, 3]);
    expect(NINEPAY_INQUIRY_FAILED_STATUSES).toEqual([6, 8, 9]);
    expect(NINEPAY_MANUAL_REVIEW_STATUSES).toEqual([3, 9]);
    expect(NINEPAY_REUSABLE_ORDER_STATUSES).toEqual([1, 2]);
    expect(NINEPAY_DEAD_ORDER_STATUSES).toEqual([6, 8]);
  });

  it("pins production error codes", () => {
    expect(NINEPAY_SUCCESS_ERROR_CODE).toBe("000");
    expect(NINEPAY_ORDER_NOT_FOUND_ERROR_CODE).toBe("221");
    expect(NINEPAY_PROCESSING_ERROR_CODE).toBe("999");
    expect(NINEPAY_MIT_DUPLICATE_ERROR_CODE).toBe("611");
    expect(NINEPAY_TOKEN_INVALID_ERROR_CODE).toBe("666");
    expect(MANUAL_REVIEW_FAILURE_CODE).toBe("MANUAL_REVIEW");
  });

  it("keeps legacy constants aligned with ground truth", () => {
    expect(NINEPAY_STATUS.SUCCESS).toBe(NINEPAY_SUCCESS_STATUS);
    expect(NINEPAY_STATUS.FAILED).toBe(NINEPAY_FAILED_STATUS);
    expect(NINEPAY_STATUS.CANCELLED).toBe(NINEPAY_CANCELLED_STATUS);
    expect(SUCCESS_STATUS).toBe(NINEPAY_SUCCESS_STATUS);
  });
});
