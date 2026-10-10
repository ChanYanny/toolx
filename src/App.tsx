import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowLeft, ArrowRight, ChevronRight, Code2, Command, Grid2X2, Heart, History, Keyboard, Menu, Moon, Search, ShieldCheck, Star, Sun, Terminal, X, Zap } from 'lucide-react';
import { Brand, FavoriteButton, LocalBadge, SearchField, Toast, ToolIcon } from './components';
import { categories, findTools, isToolId, tools, type Category, type Tool, type ToolId } from './lib/tools';
import { usePreferences } from './lib/preferences';
import { ToolWorkspace } from './ToolWorkspace';

type Route = ToolId | 'home' | 'favorites' | 'recent';
function readRoute(): Route {
  const id = location.hash.slice(1);
  return isToolId(id) || id === 'favorites' || id === 'recent' ? id : 'home';
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [category, setCategory] = useState<Category>('全部工具');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [visited, setVisited] = useState<ToolId[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const preferences = usePreferences();
  const currentTool = tools.find((tool) => tool.id === route);
  const notify = (text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 3000);
  };
  useEffect(() => {
    const change = () => { setRoute(readRoute()); setMenuOpen(false); };
    window.addEventListener('hashchange', change);
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandOpen((value) => !value);
      }
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('hashchange', change); window.removeEventListener('keydown', keydown); clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    document.title = currentTool ? `${currentTool.name} · ToolX` : 'ToolX · 开发者工具箱';
    if (isToolId(route)) {
      preferences.recordUse(route);
      setVisited((items) => items.includes(route) ? items : [...items, route]);
    }
    window.scrollTo({ top: 0 });
  }, [route]);
  const navigate = (target: Route) => { location.hash = target; setMenuOpen(false); };
  const selectCategory = (value: Category) => { setCategory(value); setQuery(''); navigate('home'); };
  const visible = findTools(query).filter((tool) =>
    (route === 'favorites' ? preferences.favorites.includes(tool.id)
      : route === 'recent' ? preferences.recent.includes(tool.id)
      : category === '全部工具' || category === tool.category));
  const shown = route === 'recent'
    ? [...visible].sort((a, b) => preferences.recent.indexOf(a.id) - preferences.recent.indexOf(b.id)) : visible;
  const pageTitle = route === 'favorites' ? '我的收藏' : route === 'recent' ? '最近使用' : '全部工具';

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>跳转到主内容</a>
    {menuOpen && <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <Brand />
      <div className="workspace-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="工作台导航">
        <a href="#home" className={route === 'home' && category === '全部工具' ? 'active' : ''} onClick={() => selectCategory('全部工具')}><Grid2X2 size={18} />全部工具<span className="nav-count">{tools.length}</span></a>
        <a href="#favorites" className={route === 'favorites' ? 'active' : ''}><Star size={18} />我的收藏{preferences.favorites.length > 0 && <span className="nav-count">{preferences.favorites.length}</span>}</a>
        <a href="#recent" className={route === 'recent' ? 'active' : ''}><History size={18} />最近使用</a>
      </nav>
      <div className="workspace-label category-label">工具分类</div>
      <nav className="category-nav" aria-label="工具分类">
        {categories.slice(1).map((item, index) => {
          const Icon = [Code2, ArrowDownUp, Zap, Terminal][index];
          return <button key={item} className={route === 'home' && category === item ? 'active' : ''} onClick={() => selectCategory(item)}><Icon size={16} />{item}<span>{tools.filter((tool) => tool.category === item).length}</span></button>;
        })}
      </nav>
      <div className="workspace-label category-label">快捷打开</div>
      <nav className="quick-nav" aria-label="快捷工具">{tools.map((tool) => {
        const Icon = tool.icon;
        return <a href={`#${tool.id}`} key={tool.id} className={route === tool.id ? 'active' : ''}><Icon size={15} />{tool.name}</a>;
      })}</nav>
      <div className="sidebar-bottom">
        <div className="privacy-card"><span className="privacy-icon"><ShieldCheck size={19} /></span><strong>你的数据，只属于你</strong><p>所有工具均在本地运行<br />无需上传，安心处理。</p><span className="privacy-tag"><i />LOCAL FIRST</span></div>
        <div className="sidebar-version"><span>ToolX <small>v1.0.0</small></span><span>Made for developers</span></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="打开导航" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={21} /></button>
          <span className="breadcrumb-root">工作台</span><ChevronRight size={13} /><span>{currentTool?.name ?? pageTitle}</span>
        </div>
        <div className="topbar-actions"><button className="command-trigger" onClick={() => setCommandOpen(true)}><Search size={15} /><span>快速查找工具</span><kbd>⌘ K</kbd></button>
          <span className="topbar-divider" /><button className="icon-button theme-toggle" aria-label="切换深色或浅色主题" title="切换主题" onClick={preferences.toggleTheme}><Moon className="moon-icon" size={18} /><Sun className="sun-icon" size={18} /></button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {!currentTool ? <>
          {route === 'home' ? <section className="hero">
            <div className="hero-copy"><div className="eyebrow"><span />为每一天的开发，准备就绪</div><h1>让开发，<span>少一点繁琐。</span></h1><p>顺手的工具，专注的工作流。<br className="mobile-break" /> 把琐碎交给 ToolX，把时间留给创造。</p>
              <div className="hero-benefits"><span><Zap size={14} />即开即用</span><span><ShieldCheck size={14} />本地处理</span><span><Heart size={14} />免费 · 无需登录</span></div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="art-grid" /><div className="code-sticker"><div><i /><i /><i /><span>hello, developer</span></div><code><span className="art-purple">const</span> day = {'{'}<br />&nbsp; focus: <span className="art-green">"create"</span>,<br />&nbsp; busywork: <span className="art-orange">false</span><br />{'}'};</code><span className="sticker-label"><CheckGlyph />工具就绪，灵感开工。</span></div><div className="floating-key"><Command size={23} /></div><div className="floating-code">{'{ }'}</div></div>
          </section> : <section className="collection-heading"><span className="eyebrow">{route === 'favorites' ? 'YOUR PERSONAL TOOLKIT' : 'PICK UP WHERE YOU LEFT OFF'}</span><h1>{pageTitle}<span className="title-dot">.</span></h1><p>{route === 'favorites' ? '把顺手的工具，放在触手可及的地方。' : '常用的工具，随时接着用。这里只记录工具名称。'}</p></section>}

          <section className="catalogue" aria-label={pageTitle}>
            <div className="section-heading"><div><h2>{route === 'home' ? '探索工具箱' : pageTitle}<span className="count-badge">{shown.length}</span></h2><p>{route === 'home' ? '小而专注，解决开发中的日常问题。' : route === 'favorites' ? '点击星标即可收藏或取消收藏。' : '按最近打开的顺序排列。'}</p></div>
              {route === 'recent' && preferences.recent.length > 0 ? <button className="button quiet" onClick={preferences.clearRecent}>清空记录</button> : <LocalBadge />}
            </div>
            <div className="catalogue-toolbar">
              {route === 'home' && <div className="filter-tabs" aria-label="筛选分类">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item === '全部工具' ? '全部' : item}</button>)}</div>}
              <SearchField value={query} onChange={setQuery} placeholder="搜索工具…" />
            </div>
            {shown.length ? <div className="tool-grid">{shown.map((tool) => <ToolCard key={tool.id} tool={tool}
              favorite={preferences.favorites.includes(tool.id)} onFavorite={() => preferences.toggleFavorite(tool.id)} />)}</div>
              : <div className="empty-state"><Search size={32} strokeWidth={1.4} /><h3>{query ? '没有找到匹配的工具' : route === 'favorites' ? '给顺手的工具，一颗星' : '从一个小工具开始'}</h3>
                <p>{query ? '试试 JSON、时间戳、编码或 Diff。' : route === 'favorites' ? '点击工具卡片右上角的星标，就能在这里快速找到它。' : '打开工具后，这里会记录你的最近使用。'}</p>
                <button className="button" onClick={() => { setQuery(''); selectCategory('全部工具'); }}>查看全部工具<ArrowRight size={14} /></button></div>}
          </section>

          {route === 'home' && <div className="bottom-note"><div className="note-symbol"><Keyboard size={22} /></div><div><strong>好工具，应该触手可及。</strong><p>按 <kbd>⌘</kbd> <kbd>K</kbd> 或 <kbd>Ctrl</kbd> <kbd>K</kbd>，快速跳转到你需要的工具。</p></div><button className="button quiet" onClick={() => setCommandOpen(true)}>试试看<ArrowRight size={15} /></button></div>}
        </> : <div className="tool-page-heading"><button className="back-link" onClick={() => selectCategory('全部工具')}><ArrowLeft size={15} />返回工具箱</button>
          <div className="tool-title-row"><ToolIcon tool={currentTool} /><div><div className="tool-eyebrow">{currentTool.english}</div><h1>{currentTool.name}</h1></div>
            <FavoriteButton name={currentTool.name} active={preferences.favorites.includes(currentTool.id)} onClick={() => preferences.toggleFavorite(currentTool.id)} /></div>
          <p>{currentTool.description}</p>
        </div>}
        {visited.map((id) => <div key={id} hidden={route !== id}><ToolWorkspace id={id} notify={notify} /></div>)}
        <footer className="page-footer"><span><span className="footer-brand">ToolX</span>让每一次开发，都更顺手。</span><span><span className="status-dot" />全部工具在本地运行</span></footer>
      </main>
    </div>
    {commandOpen && <CommandPalette close={() => setCommandOpen(false)} navigate={(id) => { navigate(id); setCommandOpen(false); }} />}
    <Toast message={message} />
  </div>;
}

function ToolCard({ tool, favorite, onFavorite }: { tool: Tool; favorite: boolean; onFavorite: () => void }) {
  return <article className="tool-card"><div className="card-top"><ToolIcon tool={tool} /><FavoriteButton name={tool.name} active={favorite} onClick={onFavorite} /></div>
    <a className="card-link" href={`#${tool.id}`}><h3>{tool.name}</h3><span className="card-english">{tool.english}</span><p>{tool.description}</p></a>
    <div className="card-bottom"><div>{tool.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><a className="card-arrow" href={`#${tool.id}`} aria-label={`打开${tool.name}`}><ArrowRight size={17} /></a></div>
  </article>;
}

function CheckGlyph() { return <span>✓</span>; }

function CommandPalette({ close, navigate }: { close: () => void; navigate: (id: ToolId) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = findTools(query);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="command-dialog" aria-labelledby="command-title" onCancel={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    onKeyDown={(event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
      if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT' && results[active]) { event.preventDefault(); navigate(results[active].id); }
    }}>
    <div className="command-head"><Search size={21} /><input id="command-title" aria-label="快速查找工具" autoFocus placeholder="你需要什么工具？" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} /><button className="icon-button" aria-label="关闭搜索" onClick={close}><X size={19} /></button></div>
    <div className="command-results"><span className="command-caption">{query ? `${results.length} 个匹配结果` : '全部工具'}</span>
      {results.map((tool, index) => <button className={`command-result ${active === index ? 'selected' : ''}`} key={tool.id} onMouseEnter={() => setActive(index)} onClick={() => navigate(tool.id)}>
        <ToolIcon tool={tool} small /><span><strong>{tool.name}</strong><small>{tool.english}</small></span><ArrowRight size={16} /></button>)}
      {results.length === 0 && <p className="command-empty">没有找到工具，试试其他关键词。</p>}
    </div>
    <div className="command-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> 选择 <kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>
  </dialog>;
}
