import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRegex, REGEX_MATCH_LIMIT, regexExamples } from '../src/lib/regex';

test('regex examples match and replacement behavior agrees with JavaScript', () => {
  for (const sample of regexExamples) {
    const result = evaluateRegex(sample);
    assert.ok(result.matches.length > 0);
    assert.equal(result.warning, '');
    assert.equal(result.replacement, sample.text.replace(new RegExp(sample.pattern, sample.flags), sample.replacement));
  }
});

test('global, case insensitive, multiline, dotAll, unicode and sticky flags work', () => {
  const check = (pattern: string, flags: string, text: string) => evaluateRegex({ pattern, flags, text, replacement: 'X' });
  assert.equal(check('a', '', 'aa').matches.length, 1);
  assert.equal(check('a', 'gi', 'aA').matches.length, 2);
  assert.equal(check('^a', 'gm', 'a\na').matches.length, 2);
  assert.equal(check('a.b', 's', 'a\nb').matches.length, 1);
  assert.equal(check('.', 'gu', '😀').matches[0].end, 2);
  assert.equal(check('a', 'gy', 'aa ba').matches.length, 2);
  assert.equal(check('a', 'y', ' ba').matches.length, 0);
});

test('zero-width global matches terminate and advance by Unicode code point', () => {
  const result = evaluateRegex({ pattern: '(?:)', flags: 'gu', text: '😀a', replacement: '_' });
  assert.deepEqual(result.matches.map((match) => [match.start, match.end]), [[0, 0], [2, 2], [3, 3]]);
  assert.equal(result.replacement, '_😀_a_');
  const units = evaluateRegex({ pattern: '(?:)', flags: 'g', text: '😀', replacement: '_' });
  assert.deepEqual(units.matches.map((match) => match.start), [0, 1, 2]);
});

test('capture indices distinguish unmatched, empty, named and lookbehind groups', () => {
  const result = evaluateRegex({ pattern: '(?<=(a))(?<letter>b)(z)?()', flags: 'g', text: 'ab', replacement: '$1-$<letter>-$3-$4' });
  assert.deepEqual(result.matches[0], { start: 1, end: 2, captures: [
    { label: '$1', start: 0, end: 1 }, { label: '$2', start: 1, end: 2 },
    { label: '$3', start: null, end: null }, { label: '$4', start: 2, end: 2 },
    { label: '$<letter>', start: 1, end: 2 },
  ] });
  assert.equal(result.replacement, 'aa-b--');
});

test('replacement dollar tokens, numeric fallback, prefixes and suffixes follow JS semantics', () => {
  const patterns = ['(a)(b)?', '(?<x>a)(?<y>b)?', '(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)', '(?:)', 'z'];
  const templates = ['$$ $& $` $\'', '$1|$2|$10|$11|$99|$01|$09|$00|$0', '$<x>/$<y>/$<missing>/$<', '$$$1', '', '$x \\n'];
  for (const pattern of patterns) for (const flags of ['', 'g']) for (const replacement of templates) {
    const text = 'ab abcdefghij a';
    assert.equal(evaluateRegex({ pattern, flags, text, replacement }).replacement,
      text.replace(new RegExp(pattern, flags), replacement), `${pattern} / ${flags} / ${replacement}`);
  }
});

test('match truncation disables partial replacement, while exact limits stay complete', () => {
  const request = { pattern: 'a', flags: 'g', replacement: 'b', text: 'a'.repeat(REGEX_MATCH_LIMIT) };
  assert.equal(evaluateRegex(request).replacement, 'b'.repeat(REGEX_MATCH_LIMIT));
  const result = evaluateRegex({ ...request, text: `${request.text}a` });
  assert.equal(result.matches.length, REGEX_MATCH_LIMIT);
  assert.equal(result.replacement, null);
  assert.match(result.warning, /仅展示前 2000/);
});

test('replacement amplification is bounded without losing match results', () => {
  const result = evaluateRegex({ pattern: 'a', flags: 'g', replacement: "$'", text: 'a'.repeat(1500) });
  assert.equal(result.matches.length, 1500);
  assert.equal(result.replacement, null);
  assert.match(result.warning, /50 万/);
});

test('invalid regex, flags, oversized inputs and too many groups are rejected', () => {
  const request = { pattern: 'a', flags: 'g', text: 'a', replacement: '' };
  for (const override of [{ pattern: '[' }, { flags: 'gg' }, { flags: 'd' }, { text: 'a'.repeat(100001) },
    { pattern: 'a'.repeat(2001) }, { replacement: 'a'.repeat(5001) }, { pattern: '()'.repeat(101) }]) {
    assert.throws(() => evaluateRegex({ ...request, ...override }));
  }
});
