import { describe, expect, it } from "vitest";

import { getRequestId } from "./api-handler.js";
import { requestIdFor } from "./request-errors.js";
import { readRequestId } from "./request-id.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe.each([
  ["readRequestId", readRequestId],
  ["getRequestId", getRequestId],
  ["requestIdFor", requestIdFor],
])("%s", (_name, read) => {
  it("keeps a caller supplied ID that is an opaque token", () => {
    expect(read({ headers: { "x-request-id": "trace_A-1" } })).toBe("trace_A-1");
  });

  it("generates an ID when the header is absent", () => {
    expect(read({ headers: {} })).toMatch(UUID);
  });

  it.each([
    ["over 64 characters", "a".repeat(65)],
    ["a log injection attempt", "id 500 admin=true"],
    ["punctuation that could shape audit records", "user@example.test"],
    ["an empty value", ""],
  ])("rejects %s", (_case, supplied) => {
    expect(read({ headers: { "x-request-id": supplied } })).toMatch(UUID);
  });
});
