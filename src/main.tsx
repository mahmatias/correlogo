import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[CorreLogo-JS] main.tsx carregado - JavaScript está rodando');
console.log('[CorreLogo-JS] Inicializando React...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
