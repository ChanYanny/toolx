import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck, Trash2 } from 'lucide-react';
import { CodeOutput, CopyButton, DownloadButton, ErrorMessage, Panel } from './components';
import { Select } from './Select';
import RegexWorker from './workers/regex.worker?worker';
import { regexExamples, REGEX_PATTERN_LIMIT, REGEX_REPLACEMENT_LIMIT, REGEX_TEXT_LIMIT, REGEX_TIMEOUT, type RegexMatch, type RegexResponse } from './lib/regex';

const flagOptions = [
  ['g', '全局', '匹配所有结果，关闭时仅匹配第一处'], ['i', '忽略大小写', '忽略字母大小写'],
  ['m', '多行', '^ 和 $ 匹配每行开头与结尾'], ['s', '点含换行', '. 也匹配换行符'],
  ['u', 'Unicode', '按 Unicode 码点匹配，支持属性转义'], ['y', '粘连', '必须从当前位置连续匹配'],
] as const;

export function RegexTool({ notify }: { notify: (message: string) => void }) {
  const [pattern, setPattern] = useState<string>(regexExamples[0].pattern);
  const [flags, setFlags] = useState<string>(regexExamples[0].flags);
  const [text, setText] = useState<string>(regexExamples[0].text);
  const [replacement, setReplacement] = useState<string>(regexExamples[0].replacement);
  const [example, setExample] = useState<string>('email');
  const [response, setResponse] = useState<RegexResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setResponse(null); setSelected(0); setBusy(!!pattern);
    if (!pattern) return;
    let worker: Worker | undefined, timeout: ReturnType<typeof setTimeout> | undefined, cancelled = false;
    const finish = (value: RegexResponse) => {
      if (cancelled) return;
      clearTimeout(timeout); worker?.terminate(); setResponse(value); setBusy(false);
    };
    const debounce = setTimeout(() => {
      try {
        worker = new RegexWorker();
        worker.onmessage = (event: MessageEvent<RegexResponse>) => finish(event.data);
        worker.onerror = (event) => { event.preventDefault(); finish({ error: '正则线程无法启动，请刷新页面后重试。' }); };
        timeout = setTimeout(() => finish({ error: '匹配超时（1.5 秒），已停止运行。请简化表达式或缩短测试文本。' }), REGEX_TIMEOUT);
        worker.postMessage({ pattern, flags, text, replacement });
      } catch { finish({ error: '正则线程无法启动，请刷新页面后重试。' }); }
    }, 250);
    return () => { cancelled = true; clearTimeout(debounce); clearTimeout(timeout); worker?.terminate(); };
  }, [pattern, flags, text, replacement, revision]);
  const result = response?.result;
  const match = result?.matches[selected];
  const captureText = (capture: { start: number | null; end: number | null }) => capture.start === null || capture.end === null ? null : text.slice(capture.start, capture.end);
  return <div className="regex-tool">
    <div className="workspace-toolbar"><span className="muted">JavaScript RegExp · 输入后自动测试</span>
      <div className="control-group"><Select label="正则示例" value={example} onChange={(value) => {
        const sample = regexExamples.find((item) => item.id === value)!;
        setExample(value); setPattern(sample.pattern); setFlags(sample.flags); setText(sample.text); setReplacement(sample.replacement); setRevision((value) => value + 1);
      }} options={regexExamples.map((sample) => ({ value: sample.id, label: sample.name }))} />
        <button className="button quiet" onClick={() => { setPattern(''); setText(''); setReplacement(''); }}><Trash2 size={14} />清空</button></div>
    </div>
    <Panel title="正则表达式" subtitle="不需要输入外层 / /" className="regex-pattern-panel">
      <div className="regex-pattern"><span>/</span><input aria-label="正则表达式" spellCheck={false} maxLength={REGEX_PATTERN_LIMIT} placeholder="例如 (?<name>\\w+)" value={pattern} onChange={(event) => setPattern(event.target.value)} /><span>/</span><code>{flags || '—'}</code></div>
      <div className="regex-flags">{flagOptions.map(([flag, label, help]) => <label key={flag} title={help} className={flags.includes(flag) ? 'active' : ''}>
        <input type="checkbox" aria-label={`${flag} ${label}`} checked={flags.includes(flag)} onChange={() => setFlags((current) => flagOptions.map(([key]) => key).filter((key) => key === flag ? !current.includes(key) : current.includes(key)).join(''))} />
        <b>{flag}</b><span>{label}</span></label>)}</div>
    </Panel>
    <ErrorMessage message={response?.error ?? ''} />
    <div className="regex-status" role="status" aria-live="polite"><span className={`status-dot ${busy ? 'working' : ''}`} />
      {!pattern ? '输入表达式开始测试；空匹配可使用 (?:)' : busy ? '正在匹配…' : result ? `${result.matches.length} 处匹配 · ${result.elapsed.toFixed(1)} ms` : '请调整表达式后重试'}
    </div>
    <div className="editor-grid regex-editors">
      <Panel title="测试文本" subtitle="最多 10 万字符"><textarea className="code-input" aria-label="正则测试文本" spellCheck={false} maxLength={REGEX_TEXT_LIMIT}
        value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴需要匹配的文本…" /><div className="editor-foot"><span>{text.length.toLocaleString()} 字符</span><span>UTF-16</span></div></Panel>
      <Panel title="匹配高亮" subtitle={result ? '点击高亮查看捕获组' : '等待匹配'}>
        <pre className="regex-highlight code-output" aria-label="匹配高亮" tabIndex={0}>{result
          ? <Highlights text={text} matches={result.matches} selected={selected} onSelect={setSelected} />
          : <span className="muted">{busy ? '正在处理…' : '匹配结果将在这里显示'}</span>}</pre>
        <div className="editor-foot"><span>{result ? result.matches.length ? '高亮为匹配内容' : '没有找到匹配' : '—'}</span><span>零宽匹配标记为 ▏</span></div>
      </Panel>
    </div>
    {result?.warning && <div className="tool-notice" role="status">{result.warning}</div>}
    {result && <Panel title="捕获组" subtitle="位置从 0 开始，结束位置不包含在内" className="regex-captures">
      {match ? <>
        <div className="match-navigation"><button className="icon-button" aria-label="上一处匹配" disabled={!selected} onClick={() => setSelected((value) => value - 1)}><ChevronLeft size={16} /></button>
          <label>第 <input aria-label="查看第几处匹配" type="number" min="1" max={result.matches.length} value={selected + 1} onChange={(event) => {
            const number = Number(event.target.value); if (Number.isInteger(number) && number >= 1 && number <= result.matches.length) setSelected(number - 1);
          }} /> / {result.matches.length} 处</label>
          <button className="icon-button" aria-label="下一处匹配" disabled={selected === result.matches.length - 1} onClick={() => setSelected((value) => value + 1)}><ChevronRight size={16} /></button>
          <span className="muted">[{match.start}, {match.end})</span>
        </div>
        <div className="capture-list">{[{ label: '$&', start: match.start, end: match.end }, ...match.captures].map((capture) => {
          const value = captureText(capture);
          return <div className="capture-row" key={capture.label}><div><code>{capture.label}</code><small>{capture.start === null ? '未参与匹配' : `[${capture.start}, ${capture.end})`}</small></div>
            <pre>{value === null ? '（未匹配）' : value === '' ? '（空字符串）' : value.length > 1000 ? `${value.slice(0, 1000)}…（显示前 1000 字符）` : value}</pre>
            <CopyButton text={value ?? ''} disabled={value === null} label={`复制 ${capture.label}`} notify={notify} /></div>;
        })}</div>
      </> : <p className="inspector-empty">没有匹配项，试着调整表达式或标志。</p>}
    </Panel>}
    <Panel title="替换预览" subtitle="JavaScript replace 语义" className="regex-replace">
      <div className="replacement-form"><label htmlFor="replacement-template" className="field-label">替换模板</label>
        <textarea id="replacement-template" className="code-input" spellCheck={false} maxLength={REGEX_REPLACEMENT_LIMIT} value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="例如 $1 或 $<name>；留空表示删除匹配内容" />
        <p className="muted"><code>$1</code> 捕获组 · <code>{'$<name>'}</code> 命名组 · <code>$&</code> 完整匹配 · <code>$$</code> 美元符号。关闭 g 时只替换第一处。</p>
      </div>
      <div className="query-result-heading"><span>替换结果</span><div className="panel-actions">
        {result?.replacement !== null && result?.replacement !== undefined && <DownloadButton text={result.replacement} filename="regex-replacement.txt" label="下载替换结果" />}
        <CopyButton text={result?.replacement ?? ''} disabled={result?.replacement == null} notify={notify} label="复制替换结果" /></div></div>
      <CodeOutput text={result?.replacement ?? (busy ? '正在处理…' : '暂无替换结果')} />
    </Panel>
    <div className="tool-tip"><ShieldCheck size={16} /><span>表达式和文本只在本地处理。耗时超过 1.5 秒自动停止，最多显示 2000 处匹配。高亮和捕获位置按 JavaScript UTF-16 索引计算。</span></div>
  </div>;
}

function Highlights({ text, matches, selected, onSelect }: { text: string; matches: RegexMatch[]; selected: number; onSelect: (index: number) => void }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    parts.push(text.slice(cursor, match.start));
    parts.push(<mark key={index} role="button" tabIndex={0} aria-label={`查看第 ${index + 1} 处匹配`}
      className={`${selected === index ? 'selected' : ''} ${match.start === match.end ? 'zero-width' : ''}`}
      title={`第 ${index + 1} 处 · [${match.start}, ${match.end})`} onClick={() => onSelect(index)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(index); } }}>
      {text.slice(match.start, match.end) || '▏'}</mark>);
    cursor = match.end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
