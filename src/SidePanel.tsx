import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Grid2X2, History, Moon, Search, Star, Sun } from 'lucide-react';
import { Brand, FavoriteButton, LocalBadge, SearchField, Toast, ToolIcon } from './components';
import { findTools, isToolId, tools, type ToolId } from './lib/tools';
import { usePreferences } from './lib/preferences';
import { ToolWorkspace } from './ToolWorkspace';
import './sidepanel.css';

type Route = ToolId | 'home';
type Collection = 'all' | 'favorites' | 'recent';

function readRoute(): Route {
  const id = location.hash.slice(1);
  return isToolId(id) ? id : 'home';
}

function fullPageUrl(route: Route) {
  const url = new URL(location.href);
  if (url.protocol.endsWith('-extension:')) url.pathname = '/tools.html';
  url.search = '';
  url.hash = route;
  return url.href;
}

export function SidePanel() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [visited, setVisited] = useState<ToolId[]>(() => isToolId(route) ? [route] : []);
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<Collection>('all');
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRegion = useRef<HTMLDivElement>(null);
  const preferences = usePreferences();
  const currentTool = tools.find((tool) => tool.id === route);
  const notify = (text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    const change = () => setRoute(readRoute());
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCollection('all');
        setQuery('');
        location.hash = 'home';
        setRoute('home');
        requestAnimationFrame(() => searchRegion.current?.querySelector('input')?.focus());
      }
    };
    window.addEventListener('hashchange', change);
    window.addEventListener('keydown', shortcut);
    return () => {
      window.removeEventListener('hashchange', change);
      window.removeEventListener('keydown', shortcut);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    document.title = currentTool ? `${currentTool.name} · ToolX 侧边栏` : 'ToolX · 随手工具箱';
    if (isToolId(route)) {
      preferences.recordUse(route);
      setVisited((items) => items.includes(route) ? items : [...items, route]);
    }
    window.scrollTo({ top: 0 });
  }, [route]);

  const results = findTools(query).filter((tool) => collection === 'favorites'
    ? preferences.favorites.includes(tool.id) : collection === 'recent' ? preferences.recent.includes(tool.id) : true);
  if (collection === 'recent') results.sort((a, b) => preferences.recent.indexOf(a.id) - preferences.recent.indexOf(b.id));

  return <div className="sidepanel-shell">
    <header className="sidepanel-header">
      <Brand />
      <div className="sidepanel-header-actions">
        <button className="icon-button" aria-label="切换深色或浅色主题" title="切换主题" onClick={preferences.toggleTheme}>
          <Moon className="moon-icon" size={17} /><Sun className="sun-icon" size={17} />
        </button>
        <a className="sidepanel-expand" href={fullPageUrl(route)} target="_blank" rel="noreferrer" title="在新标签页打开当前工具">
          <ArrowUpRight size={15} /><span>在标签页打开</span>
        </a>
      </div>
    </header>
    <main className="sidepanel-main">
      <div hidden={!!currentTool}>
        <div className="sidepanel-intro"><span className="eyebrow">ALWAYS WITHIN REACH</span><h1>顺手的工具，就在手边。</h1><p>留在当前网页，随时处理开发中的小事。</p></div>
        <div ref={searchRegion}><SearchField value={query} onChange={setQuery} placeholder="搜索工具或关键词…" /></div>
        <div className="sidepanel-tabs" aria-label="工具集合">
          <button className={collection === 'all' ? 'selected' : ''} aria-pressed={collection === 'all'} onClick={() => setCollection('all')}><Grid2X2 size={14} />全部</button>
          <button className={collection === 'favorites' ? 'selected' : ''} aria-pressed={collection === 'favorites'} onClick={() => setCollection('favorites')}><Star size={14} />收藏<span>{preferences.favorites.length}</span></button>
          <button className={collection === 'recent' ? 'selected' : ''} aria-pressed={collection === 'recent'} onClick={() => setCollection('recent')}><History size={14} />最近</button>
        </div>
        <div className="sidepanel-tools">{results.map((tool) => <div className="sidepanel-tool" key={tool.id}>
          <a href={`#${tool.id}`}><ToolIcon tool={tool} small /><span><strong>{tool.name}</strong><small>{tool.english}</small></span><ChevronRight size={15} /></a>
          <FavoriteButton name={tool.name} active={preferences.favorites.includes(tool.id)} onClick={() => preferences.toggleFavorite(tool.id)} />
        </div>)}</div>
        {!results.length && <div className="sidepanel-empty"><Search size={25} strokeWidth={1.5} /><p>{query ? '没有找到匹配的工具' : collection === 'favorites' ? '给顺手的工具点一颗星吧。' : '使用过的工具会显示在这里。'}</p>
          <button className="button quiet" onClick={() => { setQuery(''); setCollection('all'); }}>查看全部工具</button></div>}
        <div className="sidepanel-home-note"><LocalBadge /><span><kbd>⌘ / Ctrl</kbd> <kbd>K</kbd> 搜索</span></div>
      </div>
      {currentTool && <section className="sidepanel-tool-heading">
        <a className="back-link" href="#home"><ArrowLeft size={14} />全部工具</a>
        <div className="sidepanel-tool-title"><ToolIcon tool={currentTool} small /><div><h1>{currentTool.name}</h1><span>{currentTool.english}</span></div>
          <FavoriteButton name={currentTool.name} active={preferences.favorites.includes(currentTool.id)} onClick={() => preferences.toggleFavorite(currentTool.id)} />
        </div>
      </section>}
      {visited.map((id) => <section className="sidepanel-workspace" key={id} hidden={route !== id} aria-label={`${tools.find((tool) => tool.id === id)!.name}工作区`}>
        <ToolWorkspace id={id} notify={notify} />
      </section>)}
    </main>
    <footer className="sidepanel-footer"><span className="status-dot" />全部在本地处理<span>ToolX · 侧边栏</span></footer>
    <Toast message={message} />
  </div>;
}
