import assert from 'node:assert';
import test from 'node:test';

// Direct test of output comparison logic matching frontend/src/utils/outputComparison.ts
function normalizeOutput(output) {
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

function compareOutputs(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

test('normalizes trailing newlines and trailing spaces per line', () => {
  assert.strictEqual(normalizeOutput('Hello World\n'), 'Hello World');
  assert.strictEqual(normalizeOutput('1 2 3\n\n'), '1 2 3');
  assert.strictEqual(normalizeOutput('Line 1   \nLine 2  \n\n'), 'Line 1\nLine 2');
});

test('handles windows CRLF properly', () => {
  assert.strictEqual(normalizeOutput('Line 1\r\nLine 2\r\n'), 'Line 1\nLine 2');
});

test('preserves meaningful internal whitespace', () => {
  assert.notStrictEqual(normalizeOutput('Hello   World'), normalizeOutput('Hello World'));
  assert.strictEqual(compareOutputs('Hello   World', 'Hello World'), false);
});

test('compares matching actual and expected outputs accurately', () => {
  assert.strictEqual(compareOutputs('42\n', '42'), true);
  assert.strictEqual(compareOutputs('Result: 100\r\n', 'Result: 100'), true);
  assert.strictEqual(compareOutputs('Case 1: 10 \nCase 2: 20\n', 'Case 1: 10\nCase 2: 20'), true);
});

test('never reports mismatched outputs as equal', () => {
  assert.strictEqual(compareOutputs('42', '43'), false);
  assert.strictEqual(compareOutputs('Pass', 'Failed'), false);
  assert.strictEqual(compareOutputs(null, '42'), false);
  assert.strictEqual(compareOutputs(undefined, '42'), false);
});
