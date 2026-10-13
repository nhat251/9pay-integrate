import { describe, it, expect } from "vitest";
import {
  decodeIpnResult,
  extractIpnFromFormData,
  extractIpnFromUrlEncoded,
} from "../src/core/ipn";

describe("extractIpnFromFormData", () => {
  it("extracts result and checksum fields", () => {
    const formData = new FormData();
    formData.append("result", "abc");
    formData.append("checksum", "DEF");

    expect(extractIpnFromFormData(formData)).toEqual({
      result: "abc",
      checksum: "DEF",
    });
  });

  it("returns empty strings for File values instead of [object File]", () => {
    const formData = new FormData();
    formData.append("result", new File(["x"], "x.txt"));
    formData.append("checksum", "DEF");

    expect(extractIpnFromFormData(formData)).toEqual({
      result: "",
      checksum: "DEF",
    });
  });
});

describe("extractIpnFromUrlEncoded", () => {
  it("extracts result and checksum fields", () => {
    const extracted = extractIpnFromUrlEncoded("result=abc&checksum=DEF");

    expect(extracted).toEqual({ result: "abc", checksum: "DEF" });
  });

  it("preserves raw base64 + characters", () => {
    const extracted = extractIpnFromUrlEncoded("result=a+b+c&checksum=D");

    expect(extracted.result).toBe("a+b+c");
  });
});

describe("decodeIpnResult", () => {
  it("decodes base64 JSON payloads", () => {
    const result = Buffer.from(
      JSON.stringify({ invoice_no: "ORD-1", status: 5 })
    ).toString("base64");

    expect(decodeIpnResult(result)).toEqual({
      invoice_no: "ORD-1",
      status: 5,
    });
  });

  it("returns null for undecodable payloads", () => {
    expect(decodeIpnResult("")).toBeNull();
    expect(decodeIpnResult("!!!")).toBeNull();
    expect(
      decodeIpnResult(Buffer.from(JSON.stringify([1, 2])).toString("base64"))
    ).toBeNull();
  });
});
