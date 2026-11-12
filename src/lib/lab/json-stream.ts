// Reading a JSON answer while it is still being written. Claude streams its
// structured answer as text; this hands over each element of one top-level
// array (`{"results": [{…}, {…}`) as soon as its closing brace arrives, so the
// review can show results one by one instead of after the whole answer.
// The complete answer is still parsed at the end and is the one that counts.

export function arrayItemReader(key: string, onItem: (item: unknown) => void) {
  let text = "";
  let at = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  /** The last string closed at the top level: the key of the value that follows. */
  let lastKey = "";
  /** -1 before the array, 1 inside it, 2 once it closed. */
  let state = -1;
  let itemStart = -1;

  return function push(chunk: string) {
    text += chunk;
    for (; at < text.length; at++) {
      const ch = text[at];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') {
          inString = false;
          if (depth === 1) {
            try {
              lastKey = JSON.parse(text.slice(stringStart, at + 1)) as string;
            } catch {
              lastKey = "";
            }
          }
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        stringStart = at;
      } else if (ch === "{" || ch === "[") {
        depth++;
        if (ch === "[" && depth === 2 && state === -1 && lastKey === key) state = 1;
        else if (ch === "{" && depth === 3 && state === 1) itemStart = at;
      } else if (ch === "}" || ch === "]") {
        if (ch === "}" && depth === 3 && state === 1 && itemStart >= 0) {
          const item = text.slice(itemStart, at + 1);
          itemStart = -1;
          try {
            onItem(JSON.parse(item));
          } catch {
            // Not valid on its own: the final parse decides.
          }
        } else if (ch === "]" && depth === 2 && state === 1) {
          state = 2;
        }
        depth--;
      }
    }
  };
}
