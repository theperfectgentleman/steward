"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  signCollabToken,
  verifyCollabToken,
  rewriteUnreachableListenHost,
  asUint8,
  COLLAB_DEV_SECRET,
} = require("./collab-server.cjs");

describe("collab-server.cjs hmac", () => {
  it("round-trips without starting Hocuspocus", () => {
    const token = signCollabToken(
      {
        documentId: "doc_1",
        userId: "user_1",
        userName: "Ada",
        canWrite: false,
      },
      60,
      "cjs-secret",
    );
    const payload = verifyCollabToken(token, "cjs-secret");
    assert.ok(payload);
    assert.equal(payload.documentId, "doc_1");
    assert.equal(payload.canWrite, false);
  });

  it("uses the shared dev default secret name", () => {
    assert.equal(typeof COLLAB_DEV_SECRET, "string");
    assert.ok(COLLAB_DEV_SECRET.length > 8);
  });

  it("rewrites 0.0.0.0 listen URLs", () => {
    assert.equal(
      rewriteUnreachableListenHost("ws://0.0.0.0:1234"),
      "ws://127.0.0.1:1234",
    );
  });

  it("coerces Prisma Bytes-like values to Uint8Array", () => {
    const fromBuf = asUint8(Buffer.from([1, 2, 3]));
    assert.ok(fromBuf instanceof Uint8Array);
    assert.deepEqual(Array.from(fromBuf), [1, 2, 3]);
    const fromJson = asUint8({ type: "Buffer", data: [4, 5] });
    assert.deepEqual(Array.from(fromJson), [4, 5]);
  });
});
