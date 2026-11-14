import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './global.css';
createRoot(document.getElementById('root')!).render(<StrictMode><AppErrorBoundary><App/></AppErrorBoundary></StrictMode>);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* local file previews may not support service workers */ }); });
}
