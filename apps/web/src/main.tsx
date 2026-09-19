import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardProvider } from './state/store.tsx';
import { App } from './App.tsx';
import './styles/base.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BoardProvider>
      <App />
    </BoardProvider>
  </StrictMode>,
);
