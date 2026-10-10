import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SidePanel } from './SidePanel';
import './styles.css';

const sidepanelPreview = new URLSearchParams(location.search).get('view') === 'sidepanel';
createRoot(document.getElementById('root')!).render(
  <StrictMode>{sidepanelPreview ? <SidePanel /> : <App />}</StrictMode>,
);
