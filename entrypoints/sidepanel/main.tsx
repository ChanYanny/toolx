import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanel } from '../../src/SidePanel';
import '../../src/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><SidePanel /></StrictMode>,
);
