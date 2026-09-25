import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOutbox, queueOfflineAction, OUTBOX_LIMIT } from "../src/outbox.mjs";

test("offline queue rejects unknown actions", () => {
  const result = queueOfflineAction([], { type: "BUY_TICKET", payload: { amount: 1000 } });
  assert.deepEqual(result, []);
});

test("offline queue keeps only safe draft actions and bounded payload", () => {
  let queue = queueOfflineAction([], {
    type: "COMMUNITY_DRAFT",
    payload: { text: "  Allez les Écureuils !  ", password: "secret" }
  });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].type, "COMMUNITY_DRAFT");
  assert.equal(queue[0].payload.text, "Allez les Écureuils !");
  assert.equal("password" in queue[0].payload, false);

  for (let i = 0; i < OUTBOX_LIMIT + 5; i += 1) {
    queue = queueOfflineAction(queue, { type: "WATCH_PARTY_INTEREST", payload: { host: "Morocco", note: "n" + i } });
  }
  assert.ok(queue.length <= OUTBOX_LIMIT);
  assert.deepEqual(normalizeOutbox(queue), queue);
});
