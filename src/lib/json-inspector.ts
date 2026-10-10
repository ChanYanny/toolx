import { isJsonNumber, parseJsonData, stringifyJsonData } from './json-data';

export type JsonNode = {
  id: number;
  key: string;
  path: string;
  depth: number;
  parent: number | null;
  children: number[];
  end: number;
  kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  value: unknown;
};
export type JsonDocument = { nodes: JsonNode[] };
const MAX_NODES = 20_000;
const MAX_PATH_CHARS = 2_000_000;
const QUERY_WORK_LIMIT = 250_000;

export function jsonText(value: unknown, indent = 2) {
  return stringifyJsonData(value, indent);
}

export function propertyPath(parent: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

export function buildJsonDocument(text: string): JsonDocument {
  if (text.length > 2_000_000) throw new Error('结构视图最多支持 200 万字符，请使用文本视图。');
  const root: unknown = parseJsonData(text);
  const nodes: JsonNode[] = [];
  let pathChars = 0;
  const stack: { value: unknown; key: string; path: string; depth: number; parent: number | null }[] =
    [{ value: root, key: '$', path: '$', depth: 0, parent: null }];
  while (stack.length) {
    const item = stack.pop()!;
    pathChars += item.path.length;
    if (nodes.length >= MAX_NODES || item.depth > 80 || pathChars > MAX_PATH_CHARS) {
      throw new Error('结构过大：树与查询最多支持 2 万节点、80 层嵌套及 200 万路径字符，请缩小内容或使用文本视图。');
    }
    const kind = item.value === null ? 'null' : isJsonNumber(item.value) ? 'number'
      : Array.isArray(item.value) ? 'array' : typeof item.value as JsonNode['kind'];
    const node: JsonNode = { ...item, kind, id: nodes.length, children: [], end: nodes.length + 1 };
    nodes.push(node);
    if (item.parent !== null) nodes[item.parent].children.push(node.id);
    if (kind === 'object' || kind === 'array') {
      const entries = Object.entries(item.value as object);
      if (nodes.length + stack.length + entries.length > MAX_NODES) {
        throw new Error('结构视图最多支持 2 万节点，请缩小内容或使用文本视图。');
      }
      for (let i = entries.length - 1; i >= 0; i--) {
        const [key, value] = entries[i];
        stack.push({ key, value, parent: node.id, depth: item.depth + 1,
          path: kind === 'array' ? `${item.path}[${key}]` : propertyPath(item.path, key) });
      }
    }
  }
  for (let i = nodes.length - 1; i > 0; i--) {
    const node = nodes[i];
    nodes[node.parent!].end = Math.max(nodes[node.parent!].end, node.end);
  }
  return { nodes };
}

export function nodePreview(node: JsonNode) {
  if (node.kind === 'object') return `{ ${node.children.length} 个字段 }`;
  if (node.kind === 'array') return `[ ${node.children.length} 项 ]`;
  const text = jsonText(node.value, 0);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export function searchJson(document: JsonDocument, search: string) {
  const query = search.trim().toLocaleLowerCase();
  const matches = new Set<number>(), visible = new Set<number>();
  if (!query) return { matches, visible };
  for (const node of document.nodes) {
    const value = node.kind === 'array' || node.kind === 'object' ? '' : jsonText(node.value, 0);
    if (!`${node.key}\n${value}`.toLocaleLowerCase().includes(query)) continue;
    matches.add(node.id);
    let current: JsonNode | undefined = node;
    while (current && !visible.has(current.id)) {
      visible.add(current.id);
      current = current.parent === null ? undefined : document.nodes[current.parent];
    }
  }
  return { matches, visible };
}

type Selector = { recursive: boolean } & ({ kind: 'key'; key: string } | { kind: 'index'; index: number } | { kind: 'wildcard' });
function parsePath(source: string): Selector[] {
  const path = source.trim();
  if (path.length > 2000) throw new Error('JSONPath 最多支持 2000 个字符。');
  if (path[0] !== '$') throw new Error('JSONPath 必须以 $ 开头，例如 $.settings.theme。');
  const selectors: Selector[] = [];
  let i = 1;
  const fail = (): never => { throw new Error(`无法解析第 ${i + 1} 个字符。支持字段、数组索引、[*] 和递归 ..；暂不支持过滤、切片、联合或脚本表达式。`); };
  while (i < path.length) {
    let recursive = false;
    if (path.startsWith('..', i)) { recursive = true; i += 2; }
    else if (path[i] === '.') i++;
    else if (path[i] !== '[') fail();
    if (path[i] === '[') {
      i++;
      while (/\s/.test(path[i] ?? '') && i < path.length) i++;
      const quote = path[i];
      if (quote === '"' || quote === "'") {
        i++;
        let key = '', closed = false;
        while (i < path.length) {
          const char = path[i++];
          if (char === quote) { closed = true; break; }
          if (char === '\\') {
            const escaped = path[i++];
            if (escaped === "'") key += "'";
            else {
              const sequence = escaped === 'u' ? `\\u${path.slice(i, i += 4)}` : `\\${escaped}`;
              try { key += JSON.parse(`"${sequence}"`) as string; } catch { fail(); }
            }
          } else {
            if (char.charCodeAt(0) < 32) fail();
            key += char;
          }
        }
        if (!closed) fail();
        selectors.push({ kind: 'key', key, recursive });
      } else if (quote === '*') {
        i++; selectors.push({ kind: 'wildcard', recursive });
      } else {
        const match = /^-?(?:0|[1-9]\d*)/.exec(path.slice(i));
        if (!match || recursive || !Number.isSafeInteger(Number(match[0]))) fail();
        i += match![0].length;
        selectors.push({ kind: 'index', index: Number(match![0]), recursive });
      }
      while (/\s/.test(path[i] ?? '') && i < path.length) i++;
      if (path[i++] !== ']') fail();
    } else if (path[i] === '*') {
      i++; selectors.push({ kind: 'wildcard', recursive });
    } else {
      const match = /^[A-Za-z_$][\w$]*/.exec(path.slice(i));
      if (!match) fail();
      i += match![0].length;
      selectors.push({ kind: 'key', key: match![0], recursive });
    }
  }
  return selectors;
}

export function queryJson(document: JsonDocument, path: string) {
  const selectors = parsePath(path);
  let ids = [0], work = 0;
  const { nodes } = document;
  for (const selector of selectors) {
    const next = new Set<number>();
    for (const id of ids) {
      const node = nodes[id];
      const inspect = (childId: number) => {
        if (++work > QUERY_WORK_LIMIT) throw new Error('查询范围过大，请使用更具体的路径。');
        const child = nodes[childId];
        if (selector.kind === 'wildcard' || selector.kind === 'key' && child.key === selector.key
          && nodes[child.parent!].kind === 'object') next.add(childId);
      };
      if (selector.recursive) {
        for (let childId = id + 1; childId < node.end; childId++) inspect(childId);
      } else if (selector.kind === 'index') {
        if (++work > QUERY_WORK_LIMIT) throw new Error('查询范围过大，请使用更具体的路径。');
        if (node.kind === 'array') {
          const index = selector.index < 0 ? node.children.length + selector.index : selector.index;
          if (node.children[index] !== undefined) next.add(node.children[index]);
        }
      } else {
        for (const childId of node.children) inspect(childId);
      }
    }
    ids = [...next];
  }
  return ids.map((id) => nodes[id]);
}

export function queryResultText(nodes: JsonNode[]) {
  let length = 2;
  const values: string[] = [];
  for (const node of nodes) {
    const text = jsonText(node.value);
    length += text.length + 2;
    if (length > 1_000_000) throw new Error('查询结果超过 100 万字符，请缩小查询范围。');
    values.push(text);
  }
  return values.length ? `[\n${values.join(',\n')}\n]` : '[]';
}
