import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareText, decodeBase64, encodeBase64, escapeJson, formatJson, generateUuids, parseDateTime, parseTimestamp, transformUrl, unescapeJson } from '../src/lib/core';

test('JSON preserves integers beyond Number precision and decimal notation', () => {
  const text = '{"id":9223372036854775807,"decimal":0.123456789012345678901,"exp":1.25e+40}';
  assert.equal(formatJson(text, 0), text);
});

test('JSON sorts nested object keys without turning arrays or numbers into objects', () => {
  assert.equal(formatJson('{"z":[{"b":2,"a":1}],"a":null}', 0, true), '{"a":null,"z":[{"a":1,"b":2}]}');
  assert.equal(formatJson('false', 2), 'false');
  assert.equal(formatJson('"你好"', 2), '"你好"');
});

test('JSON rejects invalid documents and empty input', () => {
  for (const text of ['', '{"x":}', '{"x":1,}', '// comment\n{}']) {
    assert.throws(() => formatJson(text));
  }
});

test('JSON escaping produces a JSON string and preserves the exact original text', () => {
  assert.equal(escapeJson('{"name":"ToolX"}'), '"{\\"name\\":\\"ToolX\\"}"');
  const samples = [
    '{\n  "id": 9223372036854775807,\n  "decimal": 0.123456789012345678901\n}\n',
    '你好 👩🏽‍💻 "quoted" C:\\work\\toolx',
    '\0\b\f\n\r\t\v',
    '\ud800',
    '',
    ' \t ',
  ];
  for (const text of samples) assert.equal(unescapeJson(escapeJson(text)), text);
});

test('JSON unescaping supports quoted strings and bare escaped content', () => {
  assert.equal(unescapeJson(String.raw`{\"name\":\"ToolX\",\"path\":\"C:\\\\tools\"}`), String.raw`{"name":"ToolX","path":"C:\\tools"}`);
  assert.equal(unescapeJson(String.raw` \u4f60\u597d\n\t `), ' 你好\n\t ');
  assert.equal(unescapeJson('  "hello\\nworld"  '), 'hello\nworld');
  assert.equal(unescapeJson('""'), '');
  const escaped = escapeJson('{"name":"ToolX"}');
  assert.equal(unescapeJson(escapeJson(escaped)), escaped);
});

test('JSON unescaping rejects incomplete and invalid escape sequences', () => {
  for (const text of ['', ' ', '"unterminated', String.raw`"\x41"`, String.raw`\u12`, 'ends\\', '{"name":"ToolX"}']) {
    assert.throws(() => unescapeJson(text));
  }
});

test('Base64 round-trips UTF-8, emoji, newlines, and empty strings', () => {
  for (const text of ['你好，世界 👩🏽‍💻', 'line1\nline2\r\n', '', '\0', 'é / + =']) {
    assert.equal(decodeBase64(encodeBase64(text)), text);
  }
  assert.equal(encodeBase64('hello'), 'aGVsbG8=');
  assert.equal(decodeBase64('aGVs\nbG8='), 'hello');
  assert.equal(decodeBase64('aGVsbG8'), 'hello');
});

test('Base64 rejects corrupt input, noncanonical bits, and non-UTF8 binary', () => {
  for (const text of ['%', 'a', 'ab=c', 'aGVsbG8===', '/w==', 'Zh==']) {
    assert.throws(() => decodeBase64(text));
  }
});

test('URL modes preserve their different delimiter semantics', () => {
  const uri = 'https://example.com/?q=你好&x=1';
  assert.equal(transformUrl(uri, false, 'uri'), 'https://example.com/?q=%E4%BD%A0%E5%A5%BD&x=1');
  const encoded = transformUrl(uri, false, 'component');
  assert.ok(encoded.startsWith('https%3A%2F%2F'));
  assert.equal(transformUrl(encoded, true, 'component'), uri);
  assert.equal(transformUrl('a+b', true, 'component'), 'a+b');
  assert.throws(() => transformUrl('%E0%A4%A', true, 'component'));
});

test('timestamp conversion supports epoch, negatives, seconds and milliseconds', () => {
  assert.equal(parseTimestamp('0', 'seconds').toISOString(), '1970-01-01T00:00:00.000Z');
  assert.equal(parseTimestamp('-1', 'seconds').getTime(), -1000);
  assert.equal(parseTimestamp('1700000000', 'seconds').toISOString(), '2023-11-14T22:13:20.000Z');
  assert.equal(parseTimestamp('1700000000000', 'milliseconds').getTime(), 1700000000000);
  assert.equal(parseTimestamp('1.125', 'seconds').getTime(), 1125);
  assert.equal(parseTimestamp('1.001', 'seconds').getTime(), 1001);
  assert.equal(parseTimestamp('-0.001', 'seconds').getTime(), -1);
  assert.equal(parseTimestamp('1.0010', 'seconds').getTime(), 1001);
  assert.throws(() => parseTimestamp('1.0001', 'seconds'));
});

test('invalid and out-of-range timestamps are rejected', () => {
  for (const text of ['', 'NaN', 'Infinity', '2023-01-01', '1e10', '8640000000000001']) {
    assert.throws(() => parseTimestamp(text, 'milliseconds'));
  }
});

test('date parsing validates calendar days and preserves years below 100', () => {
  assert.equal(parseDateTime('2024-02-29T12:30:45', 'utc').toISOString(), '2024-02-29T12:30:45.000Z');
  assert.equal(parseDateTime('0099-01-01T00:00', 'utc').getUTCFullYear(), 99);
  for (const text of ['2023-02-29T00:00', '2024-04-31T00:00', '2024-01-01T24:00', 'invalid']) {
    assert.throws(() => parseDateTime(text, 'utc'));
  }
});

test('local date conversion respects the runtime timezone', () => {
  const date = parseDateTime('2024-06-15T12:30:45', 'local');
  assert.equal(date.getFullYear(), 2024);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 15);
  assert.equal(date.getHours(), 12);
  assert.equal(date.getMinutes(), 30);
});

test('UUID generation validates count and produces the v4 variant', () => {
  const values = generateUuids(100);
  assert.equal(new Set(values).size, 100);
  assert.ok(values.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.match(generateUuids(1, true, false)[0], /^[0-9A-F]{32}$/);
  for (const count of [0, 101, -1, 1.5, NaN]) assert.throws(() => generateUuids(count));
});

test('diff changes reconstruct both versions, including trailing newline differences', () => {
  for (const [before, after] of [['a\nb\n', 'a\nc\n'], ['', 'a'], ['a\n', 'a'], ['你好\n', '你好\n👋'], ['a\r\n', 'a\n']]) {
    const result = compareText(before, after);
    assert.equal(result.filter((part) => !part.added).map((part) => part.value).join(''), before);
    assert.equal(result.filter((part) => !part.removed).map((part) => part.value).join(''), after);
  }
  assert.deepEqual(compareText('', ''), []);
});

test('diff bounds reject oversized input before expensive comparison', () => {
  assert.throws(() => compareText('x'.repeat(100001), ''));
  assert.throws(() => compareText('x\n'.repeat(3001), ''));
});
