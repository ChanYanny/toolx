export const REGEX_TEXT_LIMIT = 100_000;
export const REGEX_PATTERN_LIMIT = 2000;
export const REGEX_REPLACEMENT_LIMIT = 5000;
export const REGEX_MATCH_LIMIT = 2000;
export const REGEX_TIMEOUT = 1500;
const OUTPUT_LIMIT = 500_000;
export type RegexRequest = { pattern: string; flags: string; text: string; replacement: string };
export type Capture = { label: string; start: number | null; end: number | null };
export type RegexMatch = { start: number; end: number; captures: Capture[] };
export type RegexResult = { matches: RegexMatch[]; replacement: string | null; warning: string; elapsed: number };
export type RegexResponse = { result: RegexResult; error?: never } | { error: string; result?: never };

// Incrementally build replacements so prefix/suffix tokens cannot allocate an unbounded output.
function replaceMatches(text: string, replacement: string, matches: RegExpExecArray[]) {
  const parts: string[] = [];
  let size = 0, cursor = 0;
  const append = (part: string) => {
    size += part.length;
    if (size > OUTPUT_LIMIT) throw new Error('替换结果超过 50 万字符，请缩小文本或替换范围。');
    parts.push(part);
  };
  for (const match of matches) {
    append(text.slice(cursor, match.index));
    const tokens = /\$(\$|&|`|'|<[^>]*>|\d{1,2})/g;
    let last = 0;
    for (const token of replacement.matchAll(tokens)) {
      append(replacement.slice(last, token.index));
      const key = token[1];
      if (key === '$') append('$');
      else if (key === '&') append(match[0]);
      else if (key === '`') append(text.slice(0, match.index));
      else if (key === "'") append(text.slice(match.index + match[0].length));
      else if (key[0] === '<') append(match.groups ? match.groups[key.slice(1, -1)] ?? '' : token[0]);
      else {
        const number = Number(key);
        if (number > 0 && number < match.length) append(match[number] ?? '');
        else if (key.length === 2 && Number(key[0]) > 0 && Number(key[0]) < match.length) {
          append(match[Number(key[0])] ?? ''); append(key[1]);
        } else append(token[0]);
      }
      last = token.index! + token[0].length;
    }
    append(replacement.slice(last));
    cursor = match.index + match[0].length;
  }
  append(text.slice(cursor));
  return parts.join('');
}

// Only call with user input from a terminable worker: RegExp.exec is synchronous.
export function evaluateRegex({ pattern, flags, text, replacement }: RegexRequest): RegexResult {
  if (text.length > REGEX_TEXT_LIMIT) throw new Error('测试文本最多支持 10 万字符。');
  if (pattern.length > REGEX_PATTERN_LIMIT) throw new Error('正则表达式最多支持 2000 个字符。');
  if (replacement.length > REGEX_REPLACEMENT_LIMIT) throw new Error('替换模板最多支持 5000 个字符。');
  if (!/^[gimsuy]*$/.test(flags) || new Set(flags).size !== flags.length) throw new Error('正则标志无效或重复。');
  const start = performance.now();
  const regex = new RegExp(pattern, `${flags}d`);
  const raw: RegExpExecArray[] = [], matches: RegexMatch[] = [];
  let truncated = false;
  for (;;) {
    const match = regex.exec(text);
    if (!match) break;
    if (raw.length === REGEX_MATCH_LIMIT) { truncated = true; break; }
    if (match.length > 101) throw new Error('捕获组超过 100 个，请简化表达式。');
    raw.push(match);
    const captures: Capture[] = match.indices!.slice(1).map((range, index) =>
      ({ label: `$${index + 1}`, start: range?.[0] ?? null, end: range?.[1] ?? null }));
    for (const [name, range] of Object.entries(match.indices!.groups ?? {})) {
      captures.push({ label: `$<${name}>`, start: range?.[0] ?? null, end: range?.[1] ?? null });
    }
    matches.push({ start: match.index, end: match.index + match[0].length, captures });
    if (!regex.global) break;
    if (!match[0].length) {
      regex.lastIndex += regex.unicode && (text.codePointAt(regex.lastIndex) ?? 0) > 0xffff ? 2 : 1;
    }
  }
  let warning = truncated ? '匹配超过 2000 处，仅展示前 2000 处；未生成替换预览，请缩小测试文本。' : '';
  let replaced: string | null = null;
  if (!truncated) {
    try { replaced = replaceMatches(text, replacement, raw); }
    catch (error) { warning = error instanceof Error ? error.message : '无法生成替换预览。'; }
  }
  return { matches, replacement: replaced, warning, elapsed: performance.now() - start };
}

export const regexExamples = [
  { id: 'email', name: '邮箱提取', pattern: String.raw`([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)`, flags: 'g',
    text: '联系团队：hello@toolx.dev\n反馈建议：feedback@example.com\n一起把日常工作变简单。', replacement: '$1 [at] $2' },
  { id: 'date', name: '日期重排', pattern: String.raw`(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`, flags: 'g',
    text: '创建日期：2026-09-28\n下次更新：2026-10-01', replacement: '$<day>/$<month>/$<year>' },
  { id: 'log', name: '日志筛选', pattern: String.raw`^\[(ERROR|WARN)\]\s+(.+)$`, flags: 'gm',
    text: '[INFO] 服务已启动\n[WARN] 响应时间过长\n[ERROR] 连接超时\n[INFO] 重试成功', replacement: '级别：$1，内容：$2' },
  { id: 'chinese', name: '中文匹配', pattern: String.raw`\p{Script=Han}+`, flags: 'gu',
    text: 'Hello 世界 👋\nToolX 开发者工具箱，专注每一次创造。', replacement: '[$&]' },
] as const;
