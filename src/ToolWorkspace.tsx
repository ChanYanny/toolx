import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowRight, Check, Clock3, CornerDownLeft, FileCode2, Play, Plus, Quote, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { CodeOutput, CopyButton, DownloadButton, ErrorMessage, Panel } from './components';
import { Select } from './Select';
import { JsonInspector, type JsonView } from './JsonInspector';
import { RegexTool } from './RegexTool';
import { compareText, decodeBase64, encodeBase64, escapeJson, formatJson, generateUuids, localDateInput, parseDateTime, parseTimestamp, transformUrl, unescapeJson, MAX_TEXT_LENGTH } from './lib/core';
import { examples, type ToolId } from './lib/tools';
import type { Change } from 'diff';

type Props = { notify: (message: string) => void };
type JsonAction = 'format' | 'minify' | 'escape' | 'unescape';
const jsonResultLabels: Record<JsonAction, string> = { format: '已格式化', minify: '已压缩', escape: '已转义 · JSON 字符串', unescape: '已去转义 · 原始文本' };
const errorText = (error: unknown) => error instanceof Error ? error.message : '处理失败，请检查输入。';

export function ToolWorkspace({ id, notify }: Props & { id: ToolId }) {
  if (id === 'timestamp') return <TimestampTool notify={notify} />;
  if (id === 'uuid') return <UuidTool notify={notify} />;
  if (id === 'diff') return <DiffTool notify={notify} />;
  if (id === 'regex') return <RegexTool notify={notify} />;
  return <TransformTool id={id} notify={notify} />;
}

function TransformTool({ id, notify }: Props & { id: 'json' | 'base64' | 'url' }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [indent, setIndent] = useState('2');
  const [sort, setSort] = useState(false);
  const [mode, setMode] = useState<'component' | 'uri'>('component');
  const [operation, setOperation] = useState<'encode' | 'decode'>('encode');
  const [jsonAction, setJsonAction] = useState<JsonAction>('format');
  const [jsonView, setJsonView] = useState<JsonView>('text');
  const isJsonOutput = id === 'json' && jsonAction !== 'unescape';
  const edit = (value: string) => { setInput(value); setOutput(null); setError(''); };
  const run = (action: JsonAction = 'format') => {
    try {
      const result = id === 'json'
        ? action === 'escape' ? escapeJson(input)
          : action === 'unescape' ? unescapeJson(input)
          : formatJson(input, action === 'minify' ? 0 : indent === 'tab' ? '\t' : Number(indent), sort)
        : id === 'base64' ? operation === 'encode' ? encodeBase64(input) : decodeBase64(input)
        : transformUrl(input, operation === 'decode', mode);
      setOutput(result);
      setJsonAction(action);
      if (action === 'escape' || action === 'unescape') setJsonView('text');
      setError('');
    } catch (error) { setError(errorText(error)); setOutput(null); }
  };
  const useExample = () => {
    const example = examples[id];
    edit(operation === 'decode' && id === 'base64' ? encodeBase64(example)
      : operation === 'decode' && id === 'url' ? transformUrl(example, false, mode) : example);
  };
  return <div className="transform-tool" onKeyDown={(event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); run(); }
  }}>
    <div className="workspace-toolbar">
      {id === 'json' ? <div className="control-group">
        <div className="inline-label"><label htmlFor="json-indent">缩进</label><Select id="json-indent" label="JSON 缩进" value={indent} onChange={(value) => { setIndent(value); setOutput(null); }}
          options={[{ value: '2', label: '2 个空格' }, { value: '4', label: '4 个空格' }, { value: 'tab', label: 'Tab 制表符' }]} /></div>
        <label className="checkbox-label"><input type="checkbox" checked={sort} onChange={(event) => { setSort(event.target.checked); setOutput(null); }} />按键名排序</label>
      </div> : <div className="control-group">
        <div className="segmented">{(['encode', 'decode'] as const).map((value) => <button key={value} aria-pressed={operation === value} className={operation === value ? 'selected' : ''} onClick={() => {
          setOperation(value); setOutput(null); setError('');
        }}>{value === 'encode' ? '编码 Encode' : '解码 Decode'}</button>)}</div>
        {id === 'url' && <Select label="URL 转换模式" value={mode} onChange={(value) => { setMode(value); setOutput(null); }}
          options={[{ value: 'component', label: '参数值', description: '转义参数中的空格、&、= 等字符' }, { value: 'uri', label: '完整 URL', description: '保留 /、?、& 等链接结构字符' }]} />}
      </div>}
      <button className="button quiet" onClick={useExample}><FileCode2 size={15} />载入示例</button>
    </div>
    <ErrorMessage message={error} />
    <div className="editor-grid">
      <Panel title="输入" subtitle={id === 'json' ? 'JSON / 字符串' : '待转换文本'} action={<button className="icon-button" aria-label="清空输入" title="清空输入" onClick={() => edit('')}><Trash2 size={15} /></button>}>
        <textarea className="code-input" aria-label="输入内容" spellCheck={false} value={input} maxLength={MAX_TEXT_LENGTH}
          placeholder={id === 'json' ? '{\n  \"hello\": \"world\"\n}\n\n在这里粘贴 JSON，或点击「载入示例」' : '在这里输入或粘贴文本…'}
          onChange={(event) => edit(event.target.value)} />
        <div className="editor-foot"><span>{input.length.toLocaleString()} 字符</span><span>UTF-8</span></div>
      </Panel>
      <Panel title="结果" subtitle={output === null ? '等待处理' : id === 'json' ? jsonResultLabels[jsonAction] : '转换完成'}
        action={<>{id === 'json' && <button className="button quiet small-button" disabled={output === null || output.length > MAX_TEXT_LENGTH}
          title={output !== null && output.length > MAX_TEXT_LENGTH ? '结果超过 50 万字符，无法回填' : '将结果放回输入框，继续格式化或转换'} onClick={() => edit(output ?? '')}><CornerDownLeft size={14} />回填输入</button>}
          {output !== null && <DownloadButton text={output} filename={isJsonOutput ? 'toolx.json' : `${id}.txt`} label={id === 'json' && jsonView !== 'text' ? '下载完整 JSON' : '下载结果'} />}<CopyButton text={output ?? ''} disabled={output === null} notify={notify} label={id === 'json' && jsonView !== 'text' ? '复制完整 JSON' : '复制'} /></>}>
        {id === 'json' && <div className="json-view-tabs" role="group" aria-label="JSON 结果视图">
          {([['text', '文本'], ['tree', '树形'], ['query', 'JSONPath']] as const).map(([view, label]) => <button key={view}
            aria-pressed={jsonView === view} className={jsonView === view ? 'selected' : ''} onClick={() => {
              setJsonView(view);
              if (view !== 'text' && (output === null || jsonAction === 'unescape')) run('format');
            }}>{label}</button>)}
        </div>}
        {output === null ? <div className="output-empty"><span><BracesPlaceholder /></span><p>清晰的结果，从这里开始</p><small>输入内容后点击下方按钮</small></div>
          : id === 'json' && jsonView !== 'text' ? <JsonInspector text={output} view={jsonView} notify={notify} />
          : <CodeOutput text={output || '（结果为空字符串）'} json={isJsonOutput} />}
        <div className="editor-foot"><span>{output === null ? '准备就绪' : <><Check size={12} />{output.length.toLocaleString()} 字符</>}</span><span>{isJsonOutput ? 'JSON' : 'TEXT'}</span></div>
      </Panel>
    </div>
    <div className="action-bar">
      <div className={`control-group ${id === 'json' ? 'json-actions' : ''}`}><button className="button primary" onClick={() => run()}><Play size={14} fill="currentColor" />{id === 'json' ? '格式化 JSON' : operation === 'encode' ? '开始编码' : '开始解码'}</button>
        {id === 'json' && <><button className="button" onClick={() => run('minify')}>压缩 JSON</button>
          <button className="button" title="将输入文本转成带外层双引号的 JSON 字符串" onClick={() => run('escape')}><Quote size={14} />转义</button>
          <button className="button" title="还原一层字符串转义，支持有或无外层双引号" onClick={() => run('unescape')}><ArrowLeftRight size={14} />去转义</button></>}
        {id !== 'json' && <button className="button" disabled={output === null} onClick={() => {
          edit(output ?? ''); setOperation(operation === 'encode' ? 'decode' : 'encode');
        }}><ArrowLeftRight size={14} />反向转换</button>}
      </div><span className="keyboard-hint"><kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd> 运行</span>
    </div>
    <div className="tool-tip"><ShieldCheck size={16} /><span>{id === 'json'
      ? '转义会生成带外层双引号的 JSON 字符串；去转义还原一层，支持有或无外层引号。可回填结果继续格式化。大整数与高精度数字完整保留，内容仅在本地处理。'
      : id === 'base64' ? '使用 UTF-8 文本编码。Base64 是编码方式，不是加密；此工具不用于解码二进制文件。'
      : '参数值模式会转义 /、?、&、= 等字符；完整 URL 模式保留链接结构。解码时不会将 + 替换为空格。'}</span></div>
  </div>;
}

function BracesPlaceholder() { return <FileCode2 size={28} strokeWidth={1.3} />; }

function TimestampTool({ notify }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [timestamp, setTimestamp] = useState('');
  const [unit, setUnit] = useState<'seconds' | 'milliseconds'>('seconds');
  const [dateResult, setDateResult] = useState<Date | null>(null);
  const [timestampError, setTimestampError] = useState('');
  const [datetime, setDatetime] = useState('');
  const [zone, setZone] = useState<'local' | 'utc'>('local');
  const [timeResult, setTimeResult] = useState<Date | null>(null);
  const [dateError, setDateError] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <>
    <div className="live-clock"><span className="live-dot" /><span>当前 Unix 时间戳</span><strong>{Math.floor(now / 1000)}</strong><span className="muted">秒</span>
      <button className="button quiet small-button" onClick={() => {
        setTimestamp(String(unit === 'seconds' ? Math.floor(Date.now() / 1000) : Date.now())); setDateResult(null); setTimestampError('');
      }}><ArrowDown size={14} />填入当前时间</button></div>
    <div className="conversion-grid">
      <Panel title="时间戳 → 日期" subtitle="支持秒和毫秒">
        <div className="form-content"><label className="field-label" htmlFor="timestamp-input">Unix 时间戳</label>
          <div className="input-row"><input id="timestamp-input" inputMode="decimal" placeholder="例如 1700000000" value={timestamp} onChange={(event) => { setTimestamp(event.target.value); setDateResult(null); setTimestampError(''); }} />
            <Select label="时间戳单位" value={unit} onChange={(value) => { setUnit(value); setDateResult(null); }}
              options={[{ value: 'seconds', label: '秒 (s)' }, { value: 'milliseconds', label: '毫秒 (ms)' }]} /></div>
          <button className="button primary" onClick={() => {
            try { setDateResult(parseTimestamp(timestamp, unit)); setTimestampError(''); }
            catch (error) { setTimestampError(errorText(error)); setDateResult(null); }
          }}>转换为日期<ArrowRight size={15} /></button>
          <ErrorMessage message={timestampError} />
          {dateResult ? <div className="result-list">
            <ResultRow label={`本地时间 · ${localZone}`} value={dateResult.toLocaleString('zh-CN', { hour12: false })} notify={notify} />
            <ResultRow label="UTC 时间" value={dateResult.toUTCString()} notify={notify} />
            <ResultRow label="ISO 8601" value={dateResult.toISOString()} notify={notify} />
          </div> : <div className="form-empty"><Clock3 size={24} /><p>本地时间、UTC 与 ISO 日期将在这里显示</p></div>}
        </div>
      </Panel>
      <Panel title="日期 → 时间戳" subtitle="明确时区，准确转换">
        <div className="form-content"><label className="field-label" htmlFor="datetime-input">日期与时间</label>
          <input id="datetime-input" type="datetime-local" step="1" value={datetime} onChange={(event) => { setDatetime(event.target.value); setTimeResult(null); setDateError(''); }} />
          <div className="input-row"><Select label="日期时区" value={zone} onChange={(value) => { setZone(value); setTimeResult(null); }}
            options={[{ value: 'local', label: '本地时区', description: localZone }, { value: 'utc', label: 'UTC', description: '协调世界时 · UTC+00:00' }]} />
          <button className="button quiet" onClick={() => {
            setDatetime(zone === 'utc' ? new Date().toISOString().slice(0, 19) : localDateInput(new Date())); setTimeResult(null); setDateError('');
          }}>现在</button></div>
          <button className="button primary" onClick={() => {
            try { setTimeResult(parseDateTime(datetime, zone)); setDateError(''); }
            catch (error) { setDateError(errorText(error)); setTimeResult(null); }
          }}>转换为时间戳<ArrowRight size={15} /></button>
          <ErrorMessage message={dateError} />
          {timeResult && <div className="result-list">
            <ResultRow label="秒 (s)" value={String(timeResult.getTime() / 1000)} notify={notify} />
            <ResultRow label="毫秒 (ms)" value={String(timeResult.getTime())} notify={notify} />
          </div>}
        </div>
      </Panel>
    </div>
    <div className="tool-tip"><Clock3 size={16} /><span>Unix 时间戳从 1970-01-01 00:00:00 UTC 开始计时，与时区无关。日期转换使用你选择的时区；本地时间遇到夏令时回拨时可能存在歧义，建议使用 UTC。</span></div>
  </>;
}

function ResultRow({ label, value, notify }: Props & { label: string; value: string }) {
  return <div className="result-row"><div><small>{label}</small><code>{value}</code></div><CopyButton text={value} notify={notify} /></div>;
}

function UuidTool({ notify }: Props) {
  const [count, setCount] = useState('5');
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState('');
  return <>
    <Panel title="生成设置" subtitle="UUID v4 · 密码学安全随机数">
      <div className="uuid-settings">
        <label className="inline-label">生成数量<input aria-label="生成数量" className="count-input" type="number" min="1" max="100" value={count} onChange={(event) => setCount(event.target.value)} /><small>最多 100 个</small></label>
        <label className="checkbox-label"><input type="checkbox" checked={uppercase} onChange={(event) => setUppercase(event.target.checked)} />大写字母</label>
        <label className="checkbox-label"><input type="checkbox" checked={hyphens} onChange={(event) => setHyphens(event.target.checked)} />保留连字符</label>
        <button className="button primary" onClick={() => {
          try { setValues(generateUuids(Number(count), uppercase, hyphens)); setError(''); }
          catch (error) { setError(errorText(error)); }
        }}><RefreshCw size={15} />{values.length ? '重新生成' : '生成 UUID'}</button>
      </div>
    </Panel>
    <ErrorMessage message={error} />
    <Panel className="uuid-results" title="生成结果" subtitle={`${values.length} 个 UUID`}
      action={<>{values.length > 0 && <DownloadButton text={values.join('\n')} filename="uuids.txt" />}<CopyButton text={values.join('\n')} notify={notify} disabled={!values.length} label="复制全部" /></>}>
      {values.length ? <div className="uuid-list">{values.map((value, index) => <div className="uuid-row" key={value}><span>{String(index + 1).padStart(2, '0')}</span><code>{value}</code><CopyButton text={value} notify={notify} /></div>)}</div>
        : <div className="output-empty"><span><Sparkles size={28} strokeWidth={1.3} /></span><p>下一个唯一标识，随时就绪</p><small>选择数量，点击生成</small></div>}
    </Panel>
    <div className="tool-tip"><ShieldCheck size={16} /><span>使用浏览器 Crypto API 生成 UUID v4。每次生成独立的随机标识，结果不会保存到历史记录中。</span></div>
  </>;
}

function DiffTool({ notify }: Props) {
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [result, setResult] = useState<Change[] | null>(null);
  const [error, setError] = useState('');
  const [changesOnly, setChangesOnly] = useState(false);
  const invalidate = () => { setResult(null); setError(''); };
  const added = result?.filter((part) => part.added).reduce((sum, part) => sum + (part.count ?? 0), 0) ?? 0;
  const removed = result?.filter((part) => part.removed).reduce((sum, part) => sum + (part.count ?? 0), 0) ?? 0;
  let oldLine = 0, newLine = 0;
  return <>
    <div className="workspace-toolbar"><span className="muted">逐行比较，保留空白与换行差异</span><div className="control-group">
      <button className="button quiet" onClick={() => { setBefore(after); setAfter(before); invalidate(); }}><ArrowLeftRight size={15} />交换文本</button>
      <button className="button quiet" onClick={() => { setBefore(examples.diffBefore); setAfter(examples.diffAfter); invalidate(); }}><FileCode2 size={15} />载入示例</button>
    </div></div>
    <div className="editor-grid diff-inputs">
      <Panel title="原始文本" subtitle="Before" action={<button className="icon-button" aria-label="清空原始文本" onClick={() => { setBefore(''); invalidate(); }}><Trash2 size={15} /></button>}>
        <textarea className="code-input" aria-label="原始文本" placeholder="粘贴原始版本…" spellCheck={false} maxLength={100_000} value={before} onChange={(event) => { setBefore(event.target.value); invalidate(); }} />
      </Panel>
      <Panel title="修改后文本" subtitle="After" action={<button className="icon-button" aria-label="清空修改后文本" onClick={() => { setAfter(''); invalidate(); }}><Trash2 size={15} /></button>}>
        <textarea className="code-input" aria-label="修改后文本" placeholder="粘贴修改后的版本…" spellCheck={false} maxLength={100_000} value={after} onChange={(event) => { setAfter(event.target.value); invalidate(); }} />
      </Panel>
    </div>
    <ErrorMessage message={error} />
    <div className="action-bar"><button className="button primary" onClick={() => {
      try { setResult(compareText(before, after)); setError(''); }
      catch (error) { setError(errorText(error)); setResult(null); }
    }}><Play size={14} fill="currentColor" />开始对比</button>
      <label className="checkbox-label"><input type="checkbox" checked={changesOnly} onChange={(event) => setChangesOnly(event.target.checked)} />仅显示差异</label>
    </div>
    {result && <Panel title={added || removed ? '差异结果' : '两段文本完全一致'}
      action={<><span className="diff-added"><Plus size={13} />{added} 行</span><span className="diff-removed">− {removed} 行</span>
        <CopyButton notify={notify} label="复制差异" text={result.map((part) => {
          const lines = part.value.split('\n');
          if (lines.at(-1) === '') lines.pop();
          return lines.map((line) => `${part.added ? '+' : part.removed ? '-' : ' '}${line}`).join('\n');
        }).join('\n')} /></>}>
      {added === 0 && removed === 0 ? <div className="identical"><Check size={19} />没有发现差异</div>
        : <div className="diff-result">{result.flatMap((part, index) => {
          const lines = part.value.split('\n');
          const hasNewline = lines.at(-1) === '';
          if (hasNewline) lines.pop();
          return lines.map((line, lineIndex) => {
            const left = part.added ? '' : ++oldLine;
            const right = part.removed ? '' : ++newLine;
            if (changesOnly && !part.added && !part.removed) return null;
            return <div className={`diff-line ${part.added ? 'added' : part.removed ? 'removed' : ''}`} key={`${index}-${lineIndex}`}>
              <span>{left}</span><span>{right}</span><b>{part.added ? '+' : part.removed ? '−' : ' '}</b><code>{line || ' '}{!hasNewline && lineIndex === lines.length - 1 && <small className="no-newline"> ⏎ 无末尾换行</small>}</code>
            </div>;
          });
        })}</div>}
    </Panel>}
  </>;
}
