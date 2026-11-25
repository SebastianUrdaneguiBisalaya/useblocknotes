import type { Block, BlockNotesDocument, BlockProps } from "./document.js";
import type { Operation } from "./operations.js";

/** JSON with object keys sorted, so key order never matters. */
function canonical(value: Block | Block["content"] | BlockProps): string {
  return JSON.stringify(value ?? null, (_key, nested) =>
    nested !== null && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : nested,
  );
}

function equal(
  a: Block | Block["content"] | BlockProps,
  b: Block | Block["content"] | BlockProps,
): boolean {
  return a === b || canonical(a) === canonical(b);
}

/** Indexes of a longest strictly increasing subsequence of `values`. */
function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous: number[] = [];
  for (const [index, value] of values.entries()) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      const tail = tails[mid] ?? 0;
      if ((values[tail] ?? 0) < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    previous[index] = low > 0 ? (tails[low - 1] ?? -1) : -1;
    tails[low] = index;
  }
  const result = new Set<number>();
  let cursor = tails[tails.length - 1] ?? -1;
  while (cursor !== -1) {
    result.add(cursor);
    cursor = previous[cursor] ?? -1;
  }
  return result;
}

/**
 * Computes the operations that turn `before` into `after`, matching blocks by
 * id: `set_title`, then `delete`, then `insert` and `move` in document order
 * (moving as few blocks as possible), then `update`.
 *
 * `applyOperations(before, diffDocuments(before, after))` yields `after`.
 *
 * @example
 * ```ts
 * const operations = diffDocuments(saved, editor.getDocument());
 * ```
 */
export function diffDocuments(
  before: BlockNotesDocument,
  after: BlockNotesDocument,
): Operation[] {
  const operations: Operation[] = [];
  if (before.title !== after.title) {
    operations.push({
      op: "set_title",
      title: after.title,
    });
  }

  const afterIds = new Set(after.blocks.map((block) => block.id));
  const kept: Block[] = [];
  for (const block of before.blocks) {
    if (afterIds.has(block.id)) {
      kept.push(block);
    } else {
      operations.push({
        id: block.id,
        op: "delete",
      });
    }
  }

  const keptIndex = new Map(
    kept.map((block, index) => [
      block.id,
      index,
    ]),
  );
  const common = after.blocks.filter((block) => keptIndex.has(block.id));
  const stable = new Set(
    [
      ...longestIncreasing(common.map((block) => keptIndex.get(block.id) ?? 0)),
    ].map((index) => common[index]?.id),
  );

  let afterId: string | null = null;
  for (const block of after.blocks) {
    if (!keptIndex.has(block.id)) {
      operations.push({
        afterId,
        block,
        op: "insert",
      });
    } else if (!stable.has(block.id)) {
      operations.push({
        afterId,
        id: block.id,
        op: "move",
      });
    }
    afterId = block.id;
  }

  const previous = new Map(
    kept.map((block) => [
      block.id,
      block,
    ]),
  );
  for (const block of after.blocks) {
    const old = previous.get(block.id);
    if (old === undefined || equal(old, block)) {
      continue;
    }
    const removedProp = Object.keys(old.props).some(
      (key) => !(key in block.props),
    );
    if (old.type !== block.type || removedProp) {
      // Replace the block, keeping its id.
      operations.push({
        id: block.id,
        op: "update",
        props: block.props,
        type: block.type,
        ...(block.content === undefined
          ? {}
          : {
              content: block.content,
            }),
      });
      continue;
    }
    const propsChanged = !equal(old.props, block.props);
    const contentChanged = !equal(old.content, block.content);
    operations.push({
      id: block.id,
      op: "update",
      ...(propsChanged
        ? {
            props: block.props,
          }
        : {}),
      ...(contentChanged
        ? {
            content: block.content ?? [],
          }
        : {}),
    });
  }
  return operations;
}
