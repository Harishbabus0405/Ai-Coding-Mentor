/**
 * Utility functions for test case output normalization and comparison.
 * 
 * Normalization Policy:
 * 1. Converts CRLF (\r\n) and CR (\r) to LF (\n).
 * 2. Strips trailing whitespace from each individual line.
 * 3. Trims leading and trailing empty lines/whitespace.
 * 4. Preserves intra-line spaces and meaningful internal line breaks.
 */

export function normalizeOutput(output: string | null | undefined): string {
  if (!output) {
    return '';
  }

  return output
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Compares actual program stdout against expected test case output.
 * Returns true only if both match exactly after normalization.
 */
export function compareOutputs(actual: string | null | undefined, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
