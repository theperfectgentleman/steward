import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  caretLabel,
  collapsePresenceByUser,
  colorForUserId,
  type PresenceConnection,
} from "./document-presence";

describe("document-presence", () => {
  it("collapses two tabs for the same user", () => {
    const connections: PresenceConnection[] = [
      {
        clientId: "1",
        userId: "u1",
        name: "Ada",
        color: "#0d9488",
        device: "Laptop",
      },
      {
        clientId: "2",
        userId: "u1",
        name: "Ada",
        color: "#0d9488",
        device: "Phone",
      },
      {
        clientId: "3",
        userId: "u2",
        name: "Grace",
        color: "#2563eb",
        device: "Laptop",
      },
    ];
    const people = collapsePresenceByUser(connections, "u1");
    assert.equal(people.length, 2);
    assert.equal(people[0]!.isSelf, true);
    assert.equal(people[0]!.connectionCount, 2);
    assert.deepEqual(people[0]!.devices, ["Laptop", "Phone"]);
    assert.equal(people[1]!.userId, "u2");
  });

  it("is stable for a given user id", () => {
    assert.equal(colorForUserId("abc"), colorForUserId("abc"));
    assert.equal(caretLabel("Ada Lovelace", "Laptop"), "Ada · Laptop");
  });
});
