import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import { fetchWithTimeout } from "../src/lib/supabase/fetch.ts";
import { drainOutbox } from "../src/lib/whatsapp/outbox.ts";

test("server fetch keeps the request options and explicit caller cancellation", async (t) => {
  const controller = new AbortController();
  let options;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    options = init;
    return new Response("ok");
  });
  await fetchWithTimeout("https://example.test", {
    method: "POST", body: "body", headers: { "x-test": "present" }, signal: controller.signal, cache: "no-store",
  });
  assert.equal(options.method, "POST");
  assert.equal(options.body, "body");
  assert.equal(options.headers["x-test"], "present");
  assert.equal(options.cache, "no-store");
  controller.abort(new Error("cancelled by caller"));
  assert.equal(options.signal.aborted, true);
  assert.equal(options.signal.reason, controller.signal.reason);
});

test("server fetch preserves a Request object's cancellation", async (t) => {
  const controller = new AbortController();
  let signal;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    signal = init.signal;
    return new Response("ok");
  });
  await fetchWithTimeout(new Request("https://example.test", { signal: controller.signal }));
  controller.abort();
  assert.equal(signal.aborted, true);
});

test("the deadline still aborts after response headers arrive", async (t) => {
  let signal;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    signal = init.signal;
    return new Response("ok");
  });
  await fetchWithTimeout("https://example.test", {}, 5);
  assert.equal(signal.aborted, false);
  await delay(20);
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.name, "TimeoutError");
});

test("outbox processes each row once and limits concurrent sends", async () => {
  const rows = Array.from({ length: 15 }, (_, i) => i);
  const processed = [];
  let active = 0;
  let peak = 0;
  const started = await drainOutbox(rows, async (row) => {
    active++;
    peak = Math.max(peak, active);
    await delay(1);
    processed.push(row);
    active--;
  }, { concurrency: 3 });
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.equal(started, rows.length);
  assert.deepEqual(processed.sort((a, b) => a - b), rows);
});

test("outbox rejects invalid concurrency and handles an empty queue", async () => {
  await assert.rejects(drainOutbox([1], async () => {}, { concurrency: 0 }), RangeError);
  assert.equal(await drainOutbox([], async () => assert.fail("empty queue sent a message")), 0);
});

test("outbox waits for other in-flight sends before propagating a worker error", async () => {
  let finished = false;
  const failure = new Error("worker failed");
  await assert.rejects(drainOutbox([1, 2], async (row) => {
    if (row === 1) throw failure;
    await delay(1);
    finished = true;
  }), (error) => error === failure);
  assert.equal(finished, true);
});
