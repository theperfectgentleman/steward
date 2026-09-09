import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideCollabConnect,
  resolveBrowserWsUrl,
  shouldAbandonLiveConnect,
  rewriteUnreachableListenHost,
} from "./collab-connect";

describe("resolveBrowserWsUrl", () => {
  it("rewrites 0.0.0.0 to loopback", () => {
    assert.equal(
      rewriteUnreachableListenHost("ws://0.0.0.0:1234"),
      "ws://127.0.0.1:1234",
    );
  });

  it("builds an absolute URL from a path using the page host", () => {
    assert.equal(
      resolveBrowserWsUrl("/collab", {
        protocol: "https:",
        host: "docs.example.com",
      }),
      "wss://docs.example.com/collab",
    );
  });

  it("upgrades ws:// to wss:// on HTTPS pages (non-loopback)", () => {
    assert.equal(
      resolveBrowserWsUrl("ws://collab.example.com", {
        protocol: "https:",
        host: "app.example.com",
      }),
      "wss://collab.example.com",
    );
  });

  it("leaves localhost ws:// alone even on HTTPS (local TLS is optional)", () => {
    assert.equal(
      resolveBrowserWsUrl("ws://localhost:1234", {
        protocol: "https:",
        host: "localhost:3000",
      }),
      "ws://localhost:1234",
    );
  });
});

describe("decideCollabConnect", () => {
  it("uses local mode when DISABLE_COLLAB is advertised", () => {
    assert.deepEqual(decideCollabConnect(200, { mode: "local", disabled: true }), {
      action: "local",
      reason: "disabled",
    });
  });

  it("connects with a rewritten ws URL", () => {
    const decision = decideCollabConnect(
      200,
      {
        token: "tok",
        wsUrl: "ws://0.0.0.0:1234",
        canWrite: true,
      },
      { protocol: "http:", host: "localhost:3000" },
    );
    assert.equal(decision.action, "connect");
    if (decision.action === "connect") {
      assert.equal(decision.wsUrl, "ws://127.0.0.1:1234");
      assert.equal(decision.token, "tok");
      assert.equal(decision.canWrite, true);
    }
  });

  it("falls back on HTTP errors", () => {
    assert.equal(decideCollabConnect(500, {}).action, "local");
    assert.equal(decideCollabConnect(401, {}).reason, "unauthorized");
  });
});

describe("shouldAbandonLiveConnect", () => {
  it("does not abandon a socket that already opened while waiting for sync", () => {
    assert.equal(
      shouldAbandonLiveConnect({
        cancelled: false,
        synced: false,
        everConnected: true,
        requireConnection: true,
      }),
      false,
    );
  });

  it("abandons if the socket never opened", () => {
    assert.equal(
      shouldAbandonLiveConnect({
        cancelled: false,
        synced: false,
        everConnected: false,
        requireConnection: true,
      }),
      true,
    );
  });

  it("abandons a hung sync even after connect", () => {
    assert.equal(
      shouldAbandonLiveConnect({
        cancelled: false,
        synced: false,
        everConnected: true,
        requireConnection: false,
      }),
      true,
    );
  });

  it("never abandons after a successful sync", () => {
    assert.equal(
      shouldAbandonLiveConnect({
        cancelled: false,
        synced: true,
        everConnected: true,
        requireConnection: false,
      }),
      false,
    );
  });
});
