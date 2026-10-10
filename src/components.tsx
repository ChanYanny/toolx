import { useRef, type ReactNode } from 'react';
import { Check, Copy, Download, Search, ShieldCheck, Star, X } from 'lucide-react';
import type { Tool } from './lib/tools';

export function Brand() {
  return <a href="#home" className="brand" aria-label="ToolX 首页">
    <span className="brand-mark"><span>‹</span><i /><span>›</span></span>
    <span>Tool<span className="brand-x">X</span><small>开发者工具箱</small></span>
  </a>;
}

export function ToolIcon({ tool, small = false }: { tool: Tool; small?: boolean }) {
  const Icon = tool.icon;
  return <span className={`tool-icon ${tool.color} ${small ? 'small' : ''}`}><Icon size={small ? 19 : 25} strokeWidth={1.7} /></span>;
}

export function FavoriteButton({ active, onClick, name }: { active: boolean; onClick: () => void; name: string }) {
  return <button className={`icon-button favorite ${active ? 'active' : ''}`} onClick={onClick}
    aria-label={`${active ? '取消收藏' : '收藏'}${name}`} aria-pressed={active} title={active ? '取消收藏' : '收藏工具'}>
    <Star size={17} fill={active ? 'currentColor' : 'none'} />
  </button>;
}

export function LocalBadge() {
  return <span className="local-badge"><ShieldCheck size={14} />本地处理 · 放心使用</span>;
}

export function SearchField({ value, onChange, placeholder = '搜索工具名称或关键词…', autoFocus = false }: {
  value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return <div className="search-field"><Search size={17} />
    <input aria-label="搜索工具" autoFocus={autoFocus} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    {value && <button className="icon-button" aria-label="清空搜索" onClick={() => onChange('')}><X size={15} /></button>}
  </div>;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <div role="alert" className="error-message"><span>!</span>{message}</div> : null;
}

export function CopyButton({ text, notify, label = '复制', disabled = false }: {
  text: string; notify: (text: string) => void; label?: string; disabled?: boolean;
}) {
  const copying = useRef(false);
  return <button className="button quiet small-button" disabled={disabled} onClick={async () => {
    if (copying.current) return;
    copying.current = true;
    try { await navigator.clipboard.writeText(text); notify('已复制到剪贴板'); }
    catch { notify('无法访问剪贴板，请选中结果后手动复制。'); }
    finally { copying.current = false; }
  }}><Copy size={14} />{label}</button>;
}

export function DownloadButton({ text, filename, label = '下载结果' }: { text: string; filename: string; label?: string }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={() => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }}><Download size={15} /></button>;
}

export function Panel({ title, subtitle, action, children, className = '' }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`panel ${className}`}><div className="panel-heading">
    <div><h2>{title}</h2>{subtitle && <span className="panel-subtitle">{subtitle}</span>}</div>
    <div className="panel-actions">{action}</div>
  </div>{children}</section>;
}

export function Toast({ message }: { message: string }) {
  return <div className={`toast ${message ? 'visible' : ''}`} role="status" aria-live="polite">
    {message && <><Check size={16} />{message}</>}
  </div>;
}

export function CodeOutput({ text, json = false }: { text: string; json?: boolean }) {
  if (!json || text.length > 50_000) return <pre className="code-output" tabIndex={0}>{text}</pre>;
  const tokens = text.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g);
  return <pre className="code-output" tabIndex={0}>{tokens.map((token, index) => {
    const kind = token.startsWith('"') ? /:\s*$/.test(token) ? 'key' : 'string'
      : /^(true|false|null)$/.test(token) ? 'literal' : /^-?\d/.test(token) ? 'number' : '';
    return <span className={kind ? `syntax-${kind}` : undefined} key={index}>{token}</span>;
  })}</pre>;
}
