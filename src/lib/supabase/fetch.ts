/** Server requests keep caller cancellation and have a deadline, including the response body. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const requestedSignal = init.signal !== undefined ? init.signal : input instanceof Request ? input.signal : null;
  const deadline = AbortSignal.timeout(timeoutMs);
  return fetch(input, {
    ...init,
    signal: requestedSignal ? AbortSignal.any([requestedSignal, deadline]) : deadline,
  });
}
