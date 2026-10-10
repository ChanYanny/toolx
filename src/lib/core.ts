import { isJsonNumber, parseJsonData, stringifyJsonData } from './json-data';
import { diffLines } from 'diff';

export const MAX_TEXT_LENGTH = 500_000;

export function checkText(text: string) {
  if (text.length > MAX_TEXT_LENGTH) throw new Error('内容过大，请将文本控制在 50 万字符以内。');
}

export function formatJson(text: string, indent: string | number = 2, sort = false) {
  checkText(text);
  if (!text.trim()) throw new Error('请先输入 JSON 内容。');
  let data: unknown;
  try {
    data = parseJsonData(text);
  } catch (error) {
    throw new Error(`JSON 格式有误：${error instanceof Error ? error.message : '请检查引号、逗号与括号。'}`);
  }
  function sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object' && !isJsonNumber(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => [key, sorted(item)]));
    }
    return value;
  }
  return stringifyJsonData(sort ? sorted(data) : data, indent);
}

export function escapeJson(text: string) {
  checkText(text);
  return JSON.stringify(text);
}

export function unescapeJson(text: string) {
  checkText(text);
  const trimmed = text.trim();
  if (!trimmed) throw new Error('请先输入需要去转义的内容。');
  try {
    // Accept a complete JSON string or its escaped content without outer quotes.
    const result: unknown = JSON.parse(trimmed.startsWith('"') ? trimmed : `"${text}"`);
    if (typeof result !== 'string') throw new Error();
    return result;
  } catch {
    throw new Error('无法去转义：请输入 JSON 字符串或转义后的字符串内容，检查引号、反斜杠和转义序列是否完整。');
  }
}

export function encodeBase64(text: string) {
  checkText(text);
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export function decodeBase64(text: string) {
  checkText(text);
  const clean = text.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new Error('无效的 Base64：请检查字符和结尾的填充符。');
  }
  try {
    const binary = atob(clean);
    if (btoa(binary).replace(/=+$/, '') !== clean.replace(/=+$/, '')) throw new Error();
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    throw new Error('无法解码：请使用有效的 UTF-8 文本 Base64。');
  }
}

export function transformUrl(text: string, decode: boolean, mode: 'component' | 'uri') {
  checkText(text);
  try {
    if (mode === 'uri') return decode ? decodeURI(text) : encodeURI(text);
    return decode ? decodeURIComponent(text) : encodeURIComponent(text);
  } catch {
    throw new Error('无法转换：请检查百分号转义或 Unicode 字符是否完整。');
  }
}

export function parseTimestamp(text: string, unit: 'seconds' | 'milliseconds') {
  const clean = text.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(clean)) throw new Error('请输入有效的数字时间戳。');
  if (clean.length > 32) throw new Error('时间戳超出日期范围。');
  const [whole, rawFraction = ''] = clean.replace(/^-/, '').split('.');
  const fraction = rawFraction.replace(/0+$/, '');
  const precision = unit === 'seconds' ? 3 : 0;
  if (fraction.length > precision) throw new Error('请输入精确到毫秒的时间戳。');
  const absolute = BigInt(whole) * (unit === 'seconds' ? 1000n : 1n)
    + BigInt(fraction.padEnd(precision, '0') || '0');
  const milliseconds = clean.startsWith('-') ? -absolute : absolute;
  const date = new Date(Number(milliseconds));
  if (Number.isNaN(date.getTime())) throw new Error('时间戳超出日期范围。');
  return date;
}

export function parseDateTime(text: string, zone: 'local' | 'utc') {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new Error('请选择完整的日期和时间。');
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(0);
  if (zone === 'utc') {
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
  } else {
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, 0);
  }
  const actual = zone === 'utc'
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  if (actual.some((part, i) => part !== [year, month, day, hour, minute, second][i])) {
    throw new Error('日期无效，或该本地时间处于夏令时跳过的区间。');
  }
  return date;
}

export function localDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function generateUuids(count: number, uppercase = false, hyphens = true) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('生成数量应为 1 到 100 之间的整数。');
  return Array.from({ length: count }, () => {
    let id: string = crypto.randomUUID();
    if (!hyphens) id = id.replaceAll('-', '');
    return uppercase ? id.toUpperCase() : id;
  });
}

export function compareText(before: string, after: string) {
  if (before.length > 100_000 || after.length > 100_000) throw new Error('对比文本每侧最多 10 万字符。');
  if (before.split('\n').length > 3000 || after.split('\n').length > 3000) {
    throw new Error('对比文本每侧最多 3000 行，请分段比较。');
  }
  const changes = diffLines(before, after, { timeout: 1000, maxEditLength: 4000 });
  if (!changes) throw new Error('文本差异过多，请缩小范围后再对比。');
  return changes;
}
