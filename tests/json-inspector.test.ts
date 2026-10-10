import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatJson } from '../src/lib/core';
import { buildJsonDocument, jsonText, nodePreview, queryJson, queryResultText, searchJson } from '../src/lib/json-inspector';

test('JSON tree treats lossless numbers as leaves and preserves all numeric text', () => {
  const source = '{"id":9223372036854775807,"decimal":0.123456789012345678901,"exp":1.25e+40}';
  const document = buildJsonDocument(source);
  assert.equal(document.nodes.length, 4);
  assert.deepEqual(document.nodes.slice(1).map((node) => node.kind), ['number', 'number', 'number']);
  assert.equal(document.nodes[0].end, 4);
  assert.equal(nodePreview(document.nodes[1]), '9223372036854775807');
  assert.equal(jsonText(document.nodes[0].value, 0), source);
  assert.match(queryResultText(queryJson(document, '$.*')), /0.123456789012345678901/);
});

test('every generated field path round-trips including escaped keys and array indices', () => {
  const value = { 'a.b': [{ 'quote"\\\n': 1, "it's": true, '中文': null, '': 'empty' }], '0': ['zero'], '$': { constructor: 'own' } };
  const document = buildJsonDocument(JSON.stringify(value));
  for (const node of document.nodes) assert.deepEqual(queryJson(document, node.path).map((result) => result.id), [node.id], node.path);
  assert.equal(queryJson(document, "$['a.b'][0]['it\\'s']")[0].value, true);
  assert.equal(queryJson(document, '$["\\u0030"][0]')[0].value, 'zero');
  assert.equal(queryJson(document, '$.__proto__').length, 0);
  assert.equal(queryJson(buildJsonDocument('{"__proto__":7}'), '$.__proto__').length, 1);
  for (const source of [
    '{"__proto__":7,"!__proto__":8}',
    '{"__proto__":{"polluted":true},"isLosslessNumber":true,"value":"hi"}',
    '{"a":"\\"key\\":12","b":{"isLosslessNumber":true,"toString":null}}',
  ]) {
    assert.equal(formatJson(source, 0), source);
    const parsed = buildJsonDocument(source);
    assert.equal(jsonText(parsed.nodes[0].value, 0), source);
    for (const node of parsed.nodes) assert.deepEqual(queryJson(parsed, node.path).map((result) => result.id), [node.id]);
  }
});

test('JSONPath wildcard, recursion and negative indices select document values', () => {
  const document = buildJsonDocument('{"items":[{"name":"a"},{"name":"b","child":{"name":"c"}}],"name":"root"}');
  assert.deepEqual(queryJson(document, '$.items[*].name').map((node) => node.value), ['a', 'b']);
  assert.deepEqual(queryJson(document, '$..name').map((node) => node.value), ['a', 'b', 'c', 'root']);
  assert.equal(queryJson(document, '$.items[-1].name')[0].value, 'b');
  assert.equal(queryJson(document, '$.items[2]').length, 0);
  assert.equal(queryJson(document, '$.items.length').length, 0);
  assert.equal(queryJson(document, '$.missing.child').length, 0);
  assert.equal(queryJson(document, '$..*').length, document.nodes.length - 1);
  assert.equal(queryResultText([]), '[]');
  for (const source of ['false', 'null', '12', '"hello"', '[]', '{}']) {
    assert.equal(queryJson(buildJsonDocument(source), '$').length, 1);
  }
});

test('JSON node search finds values with their ancestors, including nested collapsed branches', () => {
  const document = buildJsonDocument('{"a":[{"word":"Hello WORLD"}],"b":false,"n":9223372036854775807}');
  const found = searchJson(document, 'world');
  assert.deepEqual([...found.matches].map((id) => document.nodes[id].path), ['$.a[0].word']);
  assert.deepEqual([...found.visible].map((id) => document.nodes[id].path), ['$.a[0].word', '$.a[0]', '$.a', '$']);
  assert.equal(searchJson(document, '9223372036854775807').matches.size, 1);
  assert.equal(searchJson(document, 'missing').matches.size, 0);
});

test('JSONPath rejects malformed paths and unsupported expressions without executing code', () => {
  const document = buildJsonDocument('{"items":[1,2]}');
  for (const path of ['', 'items', '$.', '$..', '$[', '$["abc]', '$[01]', '$[-]', '$[0:2]', '$[0,1]', '$[?(@.x)]', '$[(alert(1))]', '$..[0]', '$["\\x41"]', '$[9007199254740992]']) {
    assert.throws(() => queryJson(document, path), Error, path);
  }
});

test('tree and query work are bounded with actionable errors', () => {
  assert.throws(() => buildJsonDocument(`[${'0,'.repeat(20_000)}0]`), /2 万节点/);
  assert.throws(() => buildJsonDocument('['.repeat(82) + '0' + ']'.repeat(82)), /80 层/);
  const document = buildJsonDocument(JSON.stringify(Array.from({ length: 100 }, () => 'x'.repeat(11_000))));
  assert.throws(() => queryResultText(queryJson(document, '$[*]')), /100 万/);
  const nested = buildJsonDocument('['.repeat(70) + JSON.stringify(Array(1000).fill(0)) + ']'.repeat(70));
  assert.throws(() => queryJson(nested, '$' + '..*'.repeat(20)), /查询范围过大/);
});
