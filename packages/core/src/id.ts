/**
 * Creates a unique block id. Uses `crypto.randomUUID()` when available and a
 * random fallback otherwise (for example on non-secure HTTP origins).
 *
 * @example
 * ```ts
 * const block = { id: createBlockId(), type: "paragraph", props: {} };
 * ```
 */
export function createBlockId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `${time}-${random}`;
}
