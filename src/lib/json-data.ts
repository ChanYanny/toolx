import { LosslessNumber, parse } from 'lossless-json';

export const isJsonNumber = (value: unknown): value is LosslessNumber => value instanceof LosslessNumber;

// Prefix every object key before the third-party parser assigns properties.
// This preserves __proto__ as data and avoids collisions with library internals.
export function parseJsonData(text: string): unknown {
  const protectedText = text.replace(/"(?:\\.|[^"\\])*"(\s*:)?/g, (token, colon) => colon ? `"!${token.slice(1)}` : token);
  const restore = (value: unknown, depth: number): unknown => {
    if (depth > 200) throw new Error('JSON 嵌套超过 200 层，请缩小内容。');
    if (isJsonNumber(value) || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => restore(item, depth + 1));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.slice(1), restore(item, depth + 1)]));
  };
  return restore(parse(protectedText), 0);
}

// Use instance checks: an ordinary JSON field named isLosslessNumber is data.
export function stringifyJsonData(value: unknown, space: string | number = 2): string {
  const gap = typeof space === 'number' ? ' '.repeat(Math.min(10, Math.max(0, space))) : space.slice(0, 10);
  const encode = (item: unknown, depth: number): string => {
    if (depth > 200) throw new Error('JSON 嵌套超过 200 层，请缩小内容。');
    if (isJsonNumber(item)) return item.value;
    if (item === null || typeof item !== 'object') return JSON.stringify(item);
    const array = Array.isArray(item);
    const values = array ? item.map((child) => encode(child, depth + 1))
      : Object.entries(item).map(([key, child]) => `${JSON.stringify(key)}:${gap ? ' ' : ''}${encode(child, depth + 1)}`);
    const [open, close] = array ? ['[', ']'] : ['{', '}'];
    if (!values.length) return open + close;
    const indent = gap.repeat(depth), childIndent = indent + gap;
    return gap ? `${open}\n${childIndent}${values.join(`,\n${childIndent}`)}\n${indent}${close}` : `${open}${values.join(',')}${close}`;
  };
  return encode(value, 0);
}
