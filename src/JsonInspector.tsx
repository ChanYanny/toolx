import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Link2, Search } from 'lucide-react';
import { CodeOutput, CopyButton, DownloadButton, ErrorMessage } from './components';
import { buildJsonDocument, jsonText, nodePreview, queryJson, queryResultText, searchJson, type JsonDocument } from './lib/json-inspector';

export type JsonView = 'text' | 'tree' | 'query';
type Props = { text: string; view: Exclude<JsonView, 'text'>; notify: (message: string) => void };
const errorText = (error: unknown) => error instanceof Error ? error.message : '无法读取 JSON 结构。';

export function JsonInspector({ text, view, notify }: Props) {
  const parsed = useMemo(() => {
    try { return { document: buildJsonDocument(text), error: '' }; }
    catch (error) { return { document: null, error: errorText(error) }; }
  }, [text]);
  if (!parsed.document) return <div className="inspector-error"><ErrorMessage message={parsed.error} /></div>;
  return <JsonStructure key={text} document={parsed.document} view={view} notify={notify} />;
}

function JsonStructure({ document, view, notify }: Omit<Props, 'text'> & { document: JsonDocument }) {
  const [expanded, setExpanded] = useState(() => new Set(document.nodes.filter((node) => node.depth < 2).map((node) => node.id)));
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(300);
  const [path, setPath] = useState('$');
  const [submitted, setSubmitted] = useState('$');
  const found = useMemo(() => searchJson(document, search), [document, search]);
  const rows = useMemo(() => {
    if (search.trim()) return document.nodes.filter((node) => found.visible.has(node.id));
    const visible = [];
    for (let i = 0; i < document.nodes.length;) {
      const node = document.nodes[i];
      visible.push(node);
      i = expanded.has(node.id) ? i + 1 : node.end;
    }
    return visible;
  }, [document, search, found, expanded]);
  const query = useMemo(() => {
    try {
      const nodes = queryJson(document, submitted);
      return { nodes, text: queryResultText(nodes), error: '' };
    } catch (error) { return { nodes: [], text: '', error: errorText(error) }; }
  }, [document, submitted]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); notify('已复制到剪贴板'); }
    catch { notify('无法访问剪贴板，请选中结果后手动复制。'); }
  };
  return <div className="json-inspector">
    {view === 'tree' ? <>
      <div className="inspector-toolbar">
        <div className="node-search"><Search size={14} /><input aria-label="搜索 JSON 节点" placeholder="搜索键名或值…" value={search} maxLength={200}
          onChange={(event) => { setSearch(event.target.value); setLimit(300); }} /></div>
        <div className="inspector-controls"><button className="button quiet small-button" disabled={!!search.trim()} onClick={() => {
          setExpanded(new Set(document.nodes.map((node) => node.id))); setLimit(300);
        }}>全部展开</button><button className="button quiet small-button" disabled={!!search.trim()} onClick={() => {
          setExpanded(new Set()); setLimit(300);
        }}>全部折叠</button></div>
      </div>
      <div className="inspector-caption" aria-live="polite">{search.trim() ? `${found.matches.size} 个匹配节点 · 保留上级路径` : `${document.nodes.length} 个节点 · 点击箭头展开，右侧复制路径或值`}</div>
      <div className="json-tree" role="list" aria-label="JSON 树">
        {rows.slice(0, limit).map((node) => <div role="listitem" key={node.id} className={`json-node ${found.matches.has(node.id) ? 'is-match' : ''}`}
          data-path={node.path} style={{ paddingLeft: 10 + Math.min(node.depth, 8) * 14 }}>
          {node.children.length ? <button className="icon-button tree-toggle" aria-label={`${expanded.has(node.id) || search.trim() ? '折叠' : '展开'} ${node.path}`}
            disabled={!!search.trim()} aria-expanded={expanded.has(node.id) || !!search.trim()} onClick={() => setExpanded((current) => {
              const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next;
            })}>{expanded.has(node.id) || search.trim() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button> : <span className="tree-spacer" />}
          <div className="json-node-value" title={node.path}><code className="syntax-key">{node.key.length > 80 ? `${node.key.slice(0, 80)}…` : node.key}</code><span className="node-colon">:</span>
            <code className={`syntax-${node.kind === 'boolean' || node.kind === 'null' ? 'literal' : node.kind}`}>{nodePreview(node)}</code></div>
          <div className="node-actions"><button className="icon-button" aria-label={`复制路径 ${node.path}`} title="复制 JSONPath 路径" onClick={() => void copy(node.path)}><Link2 size={13} /></button>
            <button className="icon-button" aria-label={`复制值 ${node.path}`} title="复制 JSON 值" onClick={() => void copy(jsonText(node.value))}><Copy size={13} /></button></div>
        </div>)}
        {!rows.length && <p className="inspector-empty">没有找到匹配节点</p>}
        {rows.length > limit && <button className="button quiet load-more" onClick={() => setLimit((value) => value + 300)}>再显示 300 个节点（剩余 {rows.length - limit}）</button>}
      </div>
    </> : <>
      <form className="jsonpath-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(path); }}>
        <label className="field-label" htmlFor="jsonpath-input">JSONPath 表达式</label>
        <div className="input-row"><input id="jsonpath-input" value={path} maxLength={2000} spellCheck={false} placeholder="$.settings.theme" onChange={(event) => setPath(event.target.value)} />
          <button className="button primary" type="submit">查询</button></div>
        <div className="query-examples">{['$', '$.*', '$..theme'].map((example) => <button type="button" key={example} onClick={() => { setPath(example); setSubmitted(example); }}>{example}</button>)}</div>
        <details className="syntax-help"><summary>支持的查询语法</summary><p><code>$.name</code> 字段 · <code>$["a.b"]</code> 特殊键名<br /><code>$.items[0]</code> 数组索引 · <code>[-1]</code> 最后一项<br /><code>$.items[*]</code> 所有项 · <code>$..name</code> 递归查找<br />结果统一为数组。暂不支持过滤、切片、联合和脚本。</p></details>
      </form>
      <ErrorMessage message={query.error} />
      {!query.error && <div className="query-result">
        <div className="query-result-heading"><span aria-live="polite">{query.nodes.length} 个结果{path !== submitted ? ' · 表达式已修改，点击查询更新' : ''}</span>
          <div className="panel-actions"><DownloadButton text={query.text} filename="jsonpath-results.json" label="下载查询结果" /><CopyButton text={query.text} notify={notify} label="复制查询结果" /></div></div>
        <CodeOutput text={query.text} json />
        {query.nodes.length > 0 && <details className="query-paths"><summary>查看命中路径</summary>
          {query.nodes.slice(0, 100).map((node) => <div key={node.id}><code>{node.path}</code><button className="icon-button" aria-label={`复制命中路径 ${node.path}`} onClick={() => void copy(node.path)}><Copy size={13} /></button></div>)}
          {query.nodes.length > 100 && <p className="muted">路径仅列出前 100 条，复制查询结果包含全部值。</p>}</details>}
      </div>}
    </>}
  </div>;
}
