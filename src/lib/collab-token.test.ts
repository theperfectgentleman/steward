import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { signCollabToken, verifyCollabToken, getCollabWsUrl, isCollabDisabled } from "./collab-token";

const payload = {
  documentId: "doc_1",
  userId: "user_1",
  userName: "Ada Lovelace",
  canWrite: true,
};

describe("collab-token HMAC", () => {
  it("round-trips a signed token", () => {
    const token = signCollabToken(payload, 3600, "unit-secret");
    const out = verifyCollabToken(token, "unit-secret");
    assert.ok(out);
    assert.equal(out.documentId, "doc_1");
    assert.equal(out.userId, "user_1");
    assert.equal(out.userName, "Ada Lovelace");
    assert.equal(out.canWrite, true);
    assert.ok(out.exp > Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered payload", () => {
    const token = signCollabToken(payload, 3600, "unit-secret");
    const [data, sig] = token.split(".");
    const tampered = `x${data.slice(1)}.${sig}`;
    assert.equal(verifyCollabToken(tampered, "unit-secret"), null);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signCollabToken(payload, 3600, "unit-secret");
    assert.equal(verifyCollabToken(token, "other-secret"), null);
  });

  it("rejects an expired token", () => {
    const token = signCollabToken(payload, -10, "unit-secret");
    assert.equal(verifyCollabToken(token, "unit-secret"), null);
  });

  it("rejects malformed tokens", () => {
    assert.equal(verifyCollabToken(""), null);
    assert.equal(verifyCollabToken("no-dot"), null);
    assert.equal(verifyCollabToken("a.b.c"), null);
  });
});

describe("collab-token vs collab-server.cjs", () => {
  it("verifies tokens signed by the Hocuspocus process", () => {
    const script = path.join(process.cwd(), "scripts/collab-server.cjs");
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `const { signCollabToken } = require(${JSON.stringify(script)});
         process.stdout.write(signCollabToken({
           documentId: "doc_1",
           userId: "user_1",
           userName: "Ada Lovelace",
           canWrite: true
         }, 3600, "unit-secret"));`,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const token = result.stdout.trim();
    const out = verifyCollabToken(token, "unit-secret");
    assert.ok(out);
    assert.equal(out.documentId, "doc_1");
    assert.equal(out.userId, "user_1");
  });
});

describe("getCollabWsUrl", () => {
  it("detects DISABLE_COLLAB", () => {
    const prev = process.env.DISABLE_COLLAB;
    process.env.DISABLE_COLLAB = "1";
    try {
      assert.equal(isCollabDisabled(), true);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_COLLAB;
      else process.env.DISABLE_COLLAB = prev;
    }
  });

  it("rewrites 0.0.0.0 so browsers can connect", () => {
    const prev = process.env.COLLAB_WS_URL;
    const prevPub = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
    process.env.COLLAB_WS_URL = "ws://0.0.0.0:1234";
    delete process.env.NEXT_PUBLIC_COLLAB_WS_URL;
    try {
      assert.equal(getCollabWsUrl(), "ws://127.0.0.1:1234");
    } finally {
      if (prev === undefined) delete process.env.COLLAB_WS_URL;
      else process.env.COLLAB_WS_URL = prev;
      if (prevPub === undefined) delete process.env.NEXT_PUBLIC_COLLAB_WS_URL;
      else process.env.NEXT_PUBLIC_COLLAB_WS_URL = prevPub;
    }
  });
});
