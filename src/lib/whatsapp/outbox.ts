/** Finish the selected messages with bounded concurrency. */
export async function drainOutbox<T>(
  rows: readonly T[],
  deliver: (row: T) => Promise<void>,
  { concurrency = 4 }: { concurrency?: number } = {},
): Promise<number> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError("Invalid outbox concurrency");
  let started = 0;
  const worker = async () => {
    while (started < rows.length) {
      const row = rows[started++];
      await deliver(row);
    }
  };
  // A failed worker must not leave the other sends running after the caller returns.
  const results = await Promise.allSettled(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return started;
}
